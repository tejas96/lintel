import { notificationDedupeKey } from '@lintel/domain';
import { NotFoundError, ValidationFailedError } from '@lintel/shared';
import { ProjectAccessService } from '../access/project-access.service';
import type { RequestContext } from '../common/request-context';
import type { ApplicationStores } from '../common/unit-of-work';
import type { ProjectCommandDependencies } from '../projects/command-dependencies';
import type { ProjectScheduleFacts, ScopeChangeImpact } from './scope-change.store';
import {
  calculateScopeChangeImpact,
  type ScopeChangeImpactResult,
  scopeChangeShiftIssues,
  type TaskShiftRequest,
} from './scope-change-impact';

export interface ScopeChangeProposal {
  readonly title: string;
  readonly description: string;
  readonly taskShifts: readonly TaskShiftRequest[];
}

export interface ScopeChangePreview {
  readonly impacts: ScopeChangeImpact[];
  readonly projectEndImpactDays: number;
}

function contractImpacts(result: ScopeChangeImpactResult): ScopeChangeImpact[] {
  return result.impacts.map((impact) => ({
    taskId: impact.taskId,
    taskTitle: impact.taskTitle,
    currentDueDate: impact.currentDueDate,
    proposedDueDate: impact.proposedDueDate,
    shiftWorkingDays: impact.shiftWorkingDays,
    isDownstream: impact.isDownstream,
  }));
}

/**
 * Anyone on a project can preview or propose a scope change. Proposing
 * stores the request with its schedule impact and asks every approver.
 */
export class ProposeScopeChangeCommand {
  constructor(private readonly deps: ProjectCommandDependencies) {}

  async preview(
    context: RequestContext,
    projectId: string,
    shifts: readonly TaskShiftRequest[],
  ): Promise<ScopeChangePreview> {
    const stores = this.deps.uow.stores;
    await new ProjectAccessService(stores.access).requireView(context.actor, projectId);
    const { result } = await this.assess(stores, projectId, shifts);
    return { impacts: contractImpacts(result), projectEndImpactDays: result.projectEndImpactDays };
  }

  async propose(
    context: RequestContext,
    projectId: string,
    proposal: ScopeChangeProposal,
  ): Promise<{ id: string }> {
    return this.deps.uow.transaction(async (stores) => {
      await new ProjectAccessService(stores.access).requireView(context.actor, projectId);
      const { facts, result } = await this.assess(stores, projectId, proposal.taskShifts);
      const { id } = await stores.scopeChanges.insert({
        projectId,
        title: proposal.title,
        description: proposal.description,
        requestedByUserId: context.actor.userId,
        impacts: contractImpacts(result),
        projectEndImpactDays: result.projectEndImpactDays,
      });
      await stores.records.appendActivity({
        projectId,
        taskId: null,
        actorUserId: context.actor.userId,
        type: 'scope_change.proposed',
        summary: `Proposed scope change "${proposal.title}" affecting ${result.impacts.length} task(s).`,
        payload: { scopeChangeId: id, projectEndImpactDays: result.projectEndImpactDays },
      });
      await stores.records.appendAudit({
        actorUserId: context.actor.userId,
        action: 'scope_change.proposed',
        entityType: 'scope_change',
        entityId: id,
        after: {
          projectId,
          title: proposal.title,
          taskCount: result.impacts.length,
          projectEndImpactDays: result.projectEndImpactDays,
        },
        requestId: context.requestId,
      });
      await this.askApprovers(stores, context, facts, { id, title: proposal.title, result });
      return { id };
    });
  }

  private async assess(
    stores: ApplicationStores,
    projectId: string,
    shifts: readonly TaskShiftRequest[],
  ): Promise<{ facts: ProjectScheduleFacts; result: ScopeChangeImpactResult }> {
    const facts = await stores.scopeChanges.scheduleFacts(projectId);
    if (!facts) throw new NotFoundError('Project');
    const issues = scopeChangeShiftIssues(facts, shifts);
    if (issues.length > 0) {
      throw new ValidationFailedError('Some task changes need attention.', issues);
    }
    const calendar = await stores.settings.defaultCalendar();
    return { facts, result: calculateScopeChangeImpact(facts, shifts, calendar) };
  }

  private async askApprovers(
    stores: ApplicationStores,
    context: RequestContext,
    facts: ProjectScheduleFacts,
    change: { id: string; title: string; result: ScopeChangeImpactResult },
  ): Promise<void> {
    const approvers = (
      await stores.scopeChanges.userIdsWithCapability('scope_changes.approve')
    ).filter((userId) => userId !== context.actor.userId);
    if (approvers.length === 0) return;
    const names = await stores.projects.userNames([context.actor.userId]);
    const requester = names.get(context.actor.userId) ?? 'A team member';
    const days = change.result.projectEndImpactDays;
    const impact = days > 0 ? ` It would move the planned end by ${days} working day(s).` : '';
    const notifier = await this.deps.notifierFor(stores);
    for (const userId of approvers) {
      await notifier.notify({
        recipientUserId: userId,
        kind: 'scope_change_requested',
        title: `Scope change in ${facts.name}`,
        body: `${requester} proposed "${change.title}".${impact}`,
        linkPath: `/projects/${facts.projectId}/scope-changes`,
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
