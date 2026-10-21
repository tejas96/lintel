import { domainEvent } from '@lintel/domain';
import {
  ForbiddenError,
  InvalidTransitionError,
  NotFoundError,
  StaleVersionError,
} from '@lintel/shared';
import { ProjectAccessService } from '../access/project-access.service';
import { requireCapability } from '../common/capability-guard';
import type { RequestContext } from '../common/request-context';
import type { ApplicationStores } from '../common/unit-of-work';
import type { ProjectCommandDependencies } from '../projects/command-dependencies';
import { applyApprovedSchedule } from './apply-approved-schedule';
import { type AppliedScopeAdditions, applyScopeAdditions } from './apply-scope-additions';
import type { ScopeChangeRecord } from './scope-change.store';
import { sendScopeDecisionNotices } from './scope-change-notices';

export interface ScopeChangeDecisionInput {
  readonly decision: 'approved' | 'rejected';
  readonly note: string;
  readonly expectedVersion: number;
}

const NOTHING_ADDED: AppliedScopeAdditions = { created: [], cancelled: [] };

/**
 * Approvers accept or reject a proposed scope change. Approval applies the
 * new dates, creates the added tasks and cancels the removed ones in the
 * same transaction, keeping the history; baselines never move.
 */
export class DecideScopeChangeCommand {
  constructor(private readonly deps: ProjectCommandDependencies) {}

  async execute(
    context: RequestContext,
    scopeChangeId: string,
    input: ScopeChangeDecisionInput,
  ): Promise<{ projectId: string }> {
    requireCapability(context, 'scope_changes.approve');
    return this.deps.uow.transaction(async (stores) => {
      const change = await stores.scopeChanges.findById(scopeChangeId);
      if (!change) throw new NotFoundError('Scope change');
      await new ProjectAccessService(stores.access).requireView(
        context.actor,
        change.projectId,
        'Scope change',
      );
      if (change.requestedByUserId === context.actor.userId && context.actor.role !== 'owner') {
        throw new ForbiddenError('Someone else must decide on a scope change you proposed.');
      }
      if (change.status !== 'proposed') {
        throw new InvalidTransitionError(`This scope change was already ${change.status}.`);
      }
      const decidedAt = this.deps.clock.now();
      const decided = await stores.scopeChanges.decide(scopeChangeId, input.expectedVersion, {
        status: input.decision,
        decidedByUserId: context.actor.userId,
        decidedAt,
        note: input.note,
      });
      if (!decided) throw new StaleVersionError('This scope change');
      const approved = input.decision === 'approved';
      const approval = {
        scopeChange: change,
        note: input.note,
        decidedByUserId: context.actor.userId,
        at: decidedAt,
        context,
      };
      const moves = approved ? await applyApprovedSchedule(stores, approval) : [];
      const additions = approved ? await applyScopeAdditions(stores, approval) : NOTHING_ADDED;
      await this.record(stores, context, change, input, { moved: moves.length, additions });
      const project = await stores.projects.findById(change.projectId);
      await sendScopeDecisionNotices(await this.deps.notifierFor(stores), context, {
        change,
        decision: input.decision,
        note: input.note,
        projectName: project?.name ?? 'the project',
        moves,
        additions,
      });
      return { projectId: change.projectId };
    });
  }

  private async record(
    stores: ApplicationStores,
    context: RequestContext,
    change: ScopeChangeRecord,
    input: ScopeChangeDecisionInput,
    applied: { moved: number; additions: AppliedScopeAdditions },
  ): Promise<void> {
    const counts = {
      movedCount: applied.moved,
      createdCount: applied.additions.created.length,
      cancelledCount: applied.additions.cancelled.length,
    };
    const outcome =
      input.decision === 'approved'
        ? ` ${counts.movedCount} task(s) rescheduled, ${counts.createdCount} added, ${counts.cancelledCount} cancelled.`
        : '';
    await stores.records.appendActivity({
      projectId: change.projectId,
      taskId: null,
      actorUserId: context.actor.userId,
      type: `scope_change.${input.decision}`,
      summary: `Scope change "${change.title}" ${input.decision}.${outcome}`,
      payload: { scopeChangeId: change.id, note: input.note, ...counts },
    });
    await stores.records.appendAudit({
      actorUserId: context.actor.userId,
      action: `scope_change.${input.decision}`,
      entityType: 'scope_change',
      entityId: change.id,
      before: { status: change.status },
      after: {
        status: input.decision,
        note: input.note,
        ...counts,
        createdTaskIds: applied.additions.created.map((task) => task.taskId),
        cancelledTaskIds: applied.additions.cancelled.map((task) => task.taskId),
      },
      requestId: context.requestId,
    });
    await stores.records.enqueueEvent(
      domainEvent('ScopeChangeDecided', 'scope_change', change.id, {
        scopeChangeId: change.id,
        projectId: change.projectId,
        status: input.decision,
      }),
    );
  }
}
