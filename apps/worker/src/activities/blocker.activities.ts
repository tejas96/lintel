import type { BlockerFacts, NewNotification } from '@lintel/application';
import { notificationDedupeKey } from '@lintel/domain';
import {
  type ActivityDependencies,
  notifyEach,
  uniqueRecipients,
  withNotifier,
} from './activity-dependencies';
import { type FollowUpPlan, type FollowUpSendResult, INACTIVE_PLAN } from './follow-up.types';
import { afterWorkingDays, delayUntil, formatLocalDate } from './working-time';

export type BlockerStage = 'manager' | 'owner';

/** Working days a blocker stays open before each audience hears about it. */
const BLOCKER_STAGE_WORKING_DAYS: Readonly<Record<BlockerStage, number>> = {
  manager: 1,
  owner: 3,
};

const WAITING_ON: Readonly<Record<string, string>> = {
  client: 'waiting on the client',
  supplier: 'waiting on a supplier',
  internal_dependency: 'waiting on other work',
  manager_decision: 'waiting for a manager decision',
  information: 'waiting for information',
  other: 'blocked',
};

function blockerNotification(
  blocker: BlockerFacts,
  stage: BlockerStage,
  recipientUserId: string,
  timeZone: string,
): NewNotification {
  const since = formatLocalDate(blocker.raisedAt, timeZone);
  const waiting = WAITING_ON[blocker.category] ?? 'blocked';
  const days = BLOCKER_STAGE_WORKING_DAYS[stage];
  return {
    recipientUserId,
    kind: 'task_blocked',
    title: `Blocked ${days} working day${days === 1 ? '' : 's'}: ${blocker.taskTitle}`,
    body: `"${blocker.taskTitle}" (${blocker.project.name}) has been ${waiting} since ${since}: ${blocker.reason}`,
    linkPath: `/tasks/${blocker.taskId}`,
    subjectType: 'task',
    subjectId: blocker.taskId,
    dedupeKey: notificationDedupeKey({
      kind: 'task_blocked',
      recipientId: recipientUserId,
      subjectId: blocker.taskId,
      window: `blocker:${blocker.blockerId}:${stage}`,
    }),
    groupKey: `task:${blocker.taskId}`,
  };
}

/** Activities of `blockerFollowUpWorkflow`. */
export function createBlockerActivities(deps: ActivityDependencies) {
  return {
    async planBlockerFollowUp(blockerId: string): Promise<FollowUpPlan> {
      const stores = deps.uow.stores;
      const blocker = await stores.background.followUps.blocker(blockerId);
      if (!blocker || blocker.resolvedAt !== null) return INACTIVE_PLAN;
      const calendar = await stores.settings.defaultCalendar();
      const now = deps.clock.now();
      const stages = (['manager', 'owner'] as const).map((key) => ({
        key,
        delayMs: delayUntil(
          afterWorkingDays(calendar, blocker.raisedAt, BLOCKER_STAGE_WORKING_DAYS[key]),
          now,
        ),
      }));
      return { active: true, stages };
    },

    /** Manager after 1 working day; people holding `dashboard.view_business` after 3. */
    async sendBlockerFollowUp(blockerId: string, stage: BlockerStage): Promise<FollowUpSendResult> {
      const { timeZone } = await deps.organization.settings();
      return withNotifier(deps, async (stores, notifier) => {
        const followUps = stores.background.followUps;
        const blocker = await followUps.blocker(blockerId);
        if (!blocker || blocker.resolvedAt !== null) return 'resolved';
        const recipients =
          stage === 'manager'
            ? uniqueRecipients([blocker.project.managerUserId])
            : uniqueRecipients(
                await followUps.activeUserIdsWithCapability('dashboard.view_business'),
              );
        if (recipients.length === 0) return 'no_recipient';
        await notifyEach(
          notifier,
          recipients.map((recipient) => blockerNotification(blocker, stage, recipient, timeZone)),
        );
        return 'sent';
      });
    },
  };
}
