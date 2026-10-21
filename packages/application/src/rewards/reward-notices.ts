import { type NotificationKind, notificationDedupeKey } from '@lintel/domain';
import type { Notifier } from '../notifications/notifier';

export interface RewardNotice {
  readonly title: string;
  readonly body: string;
  readonly linkPath: string;
  readonly subjectType: 'reward_evaluation' | 'milestone_reward' | 'reward_challenge';
  readonly subjectId: string;
  /** Distinguishes repeat notices about the same subject (e.g. its version or outcome). */
  readonly window: string;
}

/**
 * Sends one reward notice to each person once. Reward kinds are sensitive,
 * so the Notifier keeps the details off lock screens; the dedupe key makes
 * retries harmless.
 */
export async function sendRewardNotice(
  notifier: Notifier,
  kind: Extract<NotificationKind, 'reward_updated' | 'reward_review_requested'>,
  recipientUserIds: readonly string[],
  notice: RewardNotice,
): Promise<void> {
  for (const recipientUserId of new Set(recipientUserIds)) {
    await notifier.notify({
      recipientUserId,
      kind,
      title: notice.title,
      body: notice.body,
      linkPath: notice.linkPath,
      subjectType: notice.subjectType,
      subjectId: notice.subjectId,
      dedupeKey: notificationDedupeKey({
        kind,
        recipientId: recipientUserId,
        subjectId: notice.subjectId,
        window: notice.window,
      }),
    });
  }
}

/** Long reasons are shortened in notices; the full text is on the record. */
export function excerpt(text: string, limit = 140): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length <= limit ? flat : `${flat.slice(0, limit - 1).trimEnd()}…`;
}
