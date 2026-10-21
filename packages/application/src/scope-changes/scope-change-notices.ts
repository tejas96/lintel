import { notificationDedupeKey } from '@lintel/domain';
import type { RequestContext } from '../common/request-context';
import type { Notifier } from '../notifications/notifier';
import { notifyAboutTask, quoted } from '../tasks/task-records';
import type { AppliedScopeAdditions } from './apply-scope-additions';
import type { ScopeChangeRecord } from './scope-change.store';

export interface DecisionNotices {
  readonly change: ScopeChangeRecord;
  readonly decision: 'approved' | 'rejected';
  readonly note: string;
  readonly projectName: string;
  readonly moves: readonly { readonly ownerUserId: string | null }[];
  readonly additions: AppliedScopeAdditions;
}

/**
 * Tells the requester how their change was decided, every owner whose tasks
 * moved or were cancelled, and the owners of tasks the change created.
 */
export async function sendScopeDecisionNotices(
  notifier: Notifier,
  context: RequestContext,
  notices: DecisionNotices,
): Promise<void> {
  const { change, projectName } = notices;
  const link = `/projects/${change.projectId}/scope`;
  if (change.requestedByUserId !== context.actor.userId) {
    await notifier.notify({
      recipientUserId: change.requestedByUserId,
      kind: 'scope_change_decided',
      title: `Scope change ${notices.decision}`,
      body: `"${change.title}" in ${projectName} was ${notices.decision}: ${notices.note}`,
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
  for (const { ownerUserId } of [...notices.moves, ...notices.additions.cancelled]) {
    if (ownerUserId) perOwner.set(ownerUserId, (perOwner.get(ownerUserId) ?? 0) + 1);
  }
  for (const [ownerUserId, count] of perOwner) {
    if (ownerUserId === context.actor.userId) continue;
    await notifier.notify({
      recipientUserId: ownerUserId,
      kind: 'scope_change_decided',
      title: `Changes to your work in ${projectName}`,
      body: `Approved scope change "${change.title}" moved or cancelled ${count} of your task(s).`,
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
  for (const task of notices.additions.created) {
    await notifyAboutTask(notifier, context.actor.userId, { id: task.taskId }, 'scope-change', [
      {
        kind: 'task_assigned',
        recipientUserId: task.ownerUserId,
        title: `New task: ${quoted(task.title)}`,
        body: `Added to ${projectName} by the approved scope change "${change.title}".`,
      },
    ]);
  }
}
