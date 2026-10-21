import { notificationDedupeKey, scopeChangeMoneyIssues } from '@lintel/domain';
import { ForbiddenError, ValidationFailedError } from '@lintel/shared';
import { type ProjectAccess, ProjectAccessService } from '../access/project-access.service';
import type { RequestContext } from '../common/request-context';
import type { ApplicationStores } from '../common/unit-of-work';
import type { ProjectCommandDependencies } from '../projects/command-dependencies';
import { canSeeProjectFinances } from '../projects/project-members.rules';
import type {
  ProjectScheduleFacts,
  ScopeChangeImpact,
  ScopeChangeMoneyTerms,
  ScopeChangeNewTask,
} from './scope-change.store';
import type { ScopeChangeRequest } from './scope-change-additions';
import { type AssessedScopeChange, assessScopeChangeRequest } from './scope-change-assessment';

export interface ScopeChangeProposal extends ScopeChangeRequest {
  readonly title: string;
  readonly description: string;
  /** Approval waits for the client's recorded sign-off. */
  readonly requiresClientSignOff?: boolean;
  /** Cost to the studio and fee to the client; only people who can see the budget may set them. */
  readonly money?: Partial<ScopeChangeMoneyTerms>;
}

const NO_MONEY: ScopeChangeMoneyTerms = {
  costImpactMinor: null,
  costCategory: null,
  feeImpactMinor: null,
};

/** Checks the money terms and who may set them; the category defaults to "other". */
function moneyTerms(
  context: RequestContext,
  access: ProjectAccess,
  money: Partial<ScopeChangeMoneyTerms> | undefined,
): ScopeChangeMoneyTerms {
  const costImpactMinor = money?.costImpactMinor ?? null;
  const feeImpactMinor = money?.feeImpactMinor ?? null;
  if (costImpactMinor === null && feeImpactMinor === null) return NO_MONEY;
  if (!canSeeProjectFinances(context.actor, access)) {
    throw new ForbiddenError('Only people who can see the project budget can add a cost or fee.');
  }
  const issues = scopeChangeMoneyIssues({ costImpactMinor, feeImpactMinor });
  if (issues.length > 0) throw new ValidationFailedError('Check the amounts.', issues);
  return {
    costImpactMinor,
    costCategory: costImpactMinor === null ? null : (money?.costCategory ?? 'other'),
    feeImpactMinor,
  };
}

export interface ScopeChangePreview {
  readonly impacts: ScopeChangeImpact[];
  readonly projectEndImpactDays: number;
  readonly newTasks: ScopeChangeNewTask[];
  readonly cancellations: { readonly taskId: string; readonly taskTitle: string }[];
}

/** "2 moved, 1 added, 1 cancelled" — only the parts the change has. */
export function describeScopeChange(assessed: AssessedScopeChange): string {
  const parts = [
    assessed.impacts.length > 0 ? `${assessed.impacts.length} moved` : null,
    assessed.newTasks.length > 0 ? `${assessed.newTasks.length} added` : null,
    assessed.cancellations.length > 0 ? `${assessed.cancellations.length} cancelled` : null,
  ].filter((part): part is string => part !== null);
  return `${parts.join(', ')} task(s)`;
}

/**
 * Anyone on a project can preview or propose a scope change: date moves,
 * new tasks and cancellations together. Proposing stores the request with
 * its schedule impact and asks every approver.
 */
export class ProposeScopeChangeCommand {
  constructor(private readonly deps: ProjectCommandDependencies) {}

  async preview(
    context: RequestContext,
    projectId: string,
    request: ScopeChangeRequest,
  ): Promise<ScopeChangePreview> {
    const stores = this.deps.uow.stores;
    await new ProjectAccessService(stores.access).requireView(context.actor, projectId);
    const assessed = await assessScopeChangeRequest(stores, projectId, request);
    return {
      impacts: assessed.impacts,
      projectEndImpactDays: assessed.result.projectEndImpactDays,
      newTasks: assessed.newTasks,
      cancellations: assessed.cancellations.map(({ taskId, taskTitle }) => ({ taskId, taskTitle })),
    };
  }

  async propose(
    context: RequestContext,
    projectId: string,
    proposal: ScopeChangeProposal,
  ): Promise<{ id: string }> {
    return this.deps.uow.transaction(async (stores) => {
      const access = await new ProjectAccessService(stores.access).requireView(
        context.actor,
        projectId,
      );
      const money = moneyTerms(context, access, proposal.money);
      const requiresClientSignOff = proposal.requiresClientSignOff ?? false;
      const assessed = await assessScopeChangeRequest(stores, projectId, proposal);
      const { result } = assessed;
      const { id } = await stores.scopeChanges.insert({
        projectId,
        title: proposal.title,
        description: proposal.description,
        requestedByUserId: context.actor.userId,
        requiresClientSignOff,
        ...money,
        impacts: assessed.impacts,
        projectEndImpactDays: result.projectEndImpactDays,
        newTasks: assessed.newTasks,
        cancellations: assessed.cancellations.map(({ taskId, statusAtProposal }) => ({
          taskId,
          statusAtProposal,
        })),
      });
      await stores.records.appendActivity({
        projectId,
        taskId: null,
        actorUserId: context.actor.userId,
        type: 'scope_change.proposed',
        summary: `Proposed scope change "${proposal.title}": ${describeScopeChange(assessed)}.${
          requiresClientSignOff ? ' Needs the client’s sign-off.' : ''
        }`,
        // No money here: every project member can read the activity feed.
        payload: {
          scopeChangeId: id,
          projectEndImpactDays: result.projectEndImpactDays,
          requiresClientSignOff,
        },
      });
      await stores.records.appendAudit({
        actorUserId: context.actor.userId,
        action: 'scope_change.proposed',
        entityType: 'scope_change',
        entityId: id,
        after: {
          projectId,
          title: proposal.title,
          taskCount: assessed.impacts.length,
          newTaskCount: assessed.newTasks.length,
          cancelledTaskIds: proposal.cancelTaskIds,
          projectEndImpactDays: result.projectEndImpactDays,
          requiresClientSignOff,
          ...money,
        },
        requestId: context.requestId,
      });
      await this.askApprovers(stores, context, assessed.facts, {
        id,
        title: proposal.title,
        days: result.projectEndImpactDays,
      });
      return { id };
    });
  }

  private async askApprovers(
    stores: ApplicationStores,
    context: RequestContext,
    facts: ProjectScheduleFacts,
    change: { id: string; title: string; days: number },
  ): Promise<void> {
    const approvers = (
      await stores.scopeChanges.userIdsWithCapability('scope_changes.approve')
    ).filter((userId) => userId !== context.actor.userId);
    if (approvers.length === 0) return;
    const names = await stores.projects.userNames([context.actor.userId]);
    const requester = names.get(context.actor.userId) ?? 'A team member';
    const impact =
      change.days > 0 ? ` It would move the planned end by ${change.days} working day(s).` : '';
    const notifier = await this.deps.notifierFor(stores);
    for (const userId of approvers) {
      await notifier.notify({
        recipientUserId: userId,
        kind: 'scope_change_requested',
        title: `Scope change in ${facts.name}`,
        body: `${requester} proposed "${change.title}".${impact}`,
        linkPath: `/projects/${facts.projectId}/scope`,
        subjectType: 'scope_change',
        subjectId: change.id,
        dedupeKey: notificationDedupeKey({
          kind: 'scope_change_requested',
          recipientId: userId,
          subjectId: change.id,
        }),
      });
    }
  }
}
