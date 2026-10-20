import { domainEvent, notificationDedupeKey } from '@lintel/domain';
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
import type { ScopeChangeRecord } from './scope-change.store';

export interface ScopeChangeDecisionInput {
  readonly decision: 'approved' | 'rejected';
  readonly note: string;
  readonly expectedVersion: number;
}

/**
 * Approvers accept or reject a proposed scope change. Approval applies the
 * new dates in the same transaction and keeps the history; baselines never move.
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
      const decided = await stores.scopeChanges.decide(scopeChangeId, input.expectedVersion, {
        status: input.decision,
        decidedByUserId: context.actor.userId,
        decidedAt: this.deps.clock.now(),
        note: input.note,
      });
      if (!decided) throw new StaleVersionError('This scope change');
      const moves =
        input.decision === 'approved'
          ? await applyApprovedSchedule(stores, {
              scopeChange: change,
              note: input.note,
              decidedByUserId: context.actor.userId,
            })
          : [];
      await this.record(stores, context, change, input, moves.length);
      await this.notify(stores, context, change, input, moves);
      return { projectId: change.projectId };
    });
  }

  private async record(
    stores: ApplicationStores,
    context: RequestContext,
    change: ScopeChangeRecord,
    input: ScopeChangeDecisionInput,
    movedCount: number,
  ): Promise<void> {
    const moved = input.decision === 'approved' ? ` ${movedCount} task(s) rescheduled.` : '';
    await stores.records.appendActivity({
      projectId: change.projectId,
      taskId: null,
      actorUserId: context.actor.userId,
      type: `scope_change.${input.decision}`,
      summary: `Scope change "${change.title}" ${input.decision}.${moved}`,
      payload: { scopeChangeId: change.id, note: input.note, movedCount },
    });
    await stores.records.appendAudit({
      actorUserId: context.actor.userId,
      action: `scope_change.${input.decision}`,
      entityType: 'scope_change',
      entityId: change.id,
      before: { status: change.status },
      after: { status: input.decision, note: input.note, movedCount },
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

  private async notify(
    stores: ApplicationStores,
    context: RequestContext,
    change: ScopeChangeRecord,
    input: ScopeChangeDecisionInput,
    moves: readonly { ownerUserId: string | null }[],
  ): Promise<void> {
    const project = await stores.projects.findById(change.projectId);
    const projectName = project?.name ?? 'the project';
    const notifier = await this.deps.notifierFor(stores);
    const link = `/projects/${change.projectId}/scope-changes`;
    if (change.requestedByUserId !== context.actor.userId) {
      await notifier.notify({
        recipientUserId: change.requestedByUserId,
        kind: 'scope_change_decided',
        title: `Scope change ${input.decision}`,
        body: `"${change.title}" in ${projectName} was ${input.decision}: ${input.note}`,
        linkPath: link,
        subjectType: 'scope_change',
        subjectId: change.id,
        dedupeKey: notificationDedupeKey({
          kind: 'scope_change_decided',
          recipientId: change.requestedByUserId,
          subjectId: change.id,
          window: 'decision',
        }),
      });
    }
    const perOwner = new Map<string, number>();
    for (const move of moves) {
      if (move.ownerUserId)
        perOwner.set(move.ownerUserId, (perOwner.get(move.ownerUserId) ?? 0) + 1);
    }
    for (const [ownerUserId, count] of perOwner) {
      if (ownerUserId === context.actor.userId) continue;
      await notifier.notify({
        recipientUserId: ownerUserId,
        kind: 'scope_change_decided',
        title: `New dates in ${projectName}`,
        body: `Approved scope change "${change.title}" moved ${count} of your task(s).`,
        linkPath: link,
        subjectType: 'scope_change',
        subjectId: change.id,
        dedupeKey: notificationDedupeKey({
          kind: 'scope_change_decided',
          recipientId: ownerUserId,
          subjectId: change.id,
          window: 'schedule',
        }),
      });
    }
  }
}
