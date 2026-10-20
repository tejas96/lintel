import type { NewNotification } from '@lintel/application';
import { notificationDedupeKey } from '@lintel/domain';
import type { ReviewSubject } from '../workflows/workflow-contract';
import { type ActivityDependencies, calendarFor, withNotifier } from './activity-dependencies';
import { type FollowUpPlan, type FollowUpSendResult, INACTIVE_PLAN } from './follow-up.types';
import { loadReviewState, type ReviewState } from './review-state';
import { afterWorkingDays, delayUntil, formatLocalDate } from './working-time';

export type ReviewStage = 'reviewer' | 'manager';

/** Working days after submission: remind the reviewer after 1, the manager 2 days later. */
const REVIEW_STAGE_WORKING_DAYS: Readonly<Record<ReviewStage, number>> = {
  reviewer: 1,
  manager: 3,
};

function reviewNotification(
  state: ReviewState,
  stage: ReviewStage,
  recipientUserId: string,
  timeZone: string,
): NewNotification {
  const submitted = formatLocalDate(state.submittedAt, timeZone);
  const by = state.submitterName ? ` by ${state.submitterName}` : '';
  const text =
    stage === 'reviewer'
      ? {
          title: `Review waiting: ${state.title}`,
          body: `"${state.title}" (${state.projectName}) was submitted${by} on ${submitted} and is waiting for your review.`,
        }
      : {
          title: `Review overdue: ${state.title}`,
          body: `"${state.title}" (${state.projectName}) has waited 3 working days for a review decision.`,
        };
  return {
    recipientUserId,
    kind: 'review_reminder',
    ...text,
    linkPath: state.linkPath,
    subjectType: state.subjectType,
    subjectId: state.subjectId,
    dedupeKey: notificationDedupeKey({
      kind: 'review_reminder',
      recipientId: recipientUserId,
      subjectId: state.subjectId,
      window: `${state.roundKey}:${stage}`,
    }),
    groupKey: `${state.subjectType}:${state.subjectId}`,
  };
}

/** Activities of `reviewFollowUpWorkflow` (task reviews and deliverable versions). */
export function createReviewActivities(deps: ActivityDependencies) {
  return {
    async planReviewFollowUp(subject: ReviewSubject): Promise<FollowUpPlan> {
      const stores = deps.uow.stores;
      const state = await loadReviewState(stores.background.followUps, subject);
      if (!state?.pending) return INACTIVE_PLAN;
      const calendar = await calendarFor(stores, state.reviewerUserId);
      const now = deps.clock.now();
      const stages = (['reviewer', 'manager'] as const).map((key) => ({
        key,
        delayMs: delayUntil(
          afterWorkingDays(calendar, state.submittedAt, REVIEW_STAGE_WORKING_DAYS[key]),
          now,
        ),
      }));
      return { active: true, stages };
    },

    /** Reminds the reviewer (or, without one, the manager), then escalates to the manager. */
    async sendReviewFollowUp(
      subject: ReviewSubject,
      stage: ReviewStage,
    ): Promise<FollowUpSendResult> {
      const { timeZone } = await deps.organization.settings();
      return withNotifier(deps, async (stores, notifier) => {
        const state = await loadReviewState(stores.background.followUps, subject);
        if (!state?.pending) return 'resolved';
        const recipient =
          stage === 'reviewer'
            ? (state.reviewerUserId ?? state.managerUserId)
            : state.managerUserId;
        await notifier.notify(reviewNotification(state, stage, recipient, timeZone));
        return 'sent';
      });
    },
  };
}
