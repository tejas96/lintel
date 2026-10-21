import { messagePreviewFor } from './notification.policy';
import {
  NOTIFICATION_URGENCY,
  type NotificationKind,
  type NotificationUrgency,
} from './notification-kinds';

/** Kinds in the order people think about them (the account page uses the same grouping). */
export const NOTIFICATION_KIND_GROUPS: readonly {
  readonly title: string;
  readonly kinds: readonly NotificationKind[];
}[] = [
  {
    title: 'Your work',
    kinds: [
      'task_assigned',
      'task_reassigned',
      'deadline_upcoming',
      'task_overdue',
      'priority_changed',
    ],
  },
  {
    title: 'Blockers and reviews',
    kinds: [
      'task_blocked',
      'blocker_resolved',
      'review_requested',
      'review_reminder',
      'review_decided',
    ],
  },
  {
    title: 'Leave and cover',
    kinds: [
      'leave_requested',
      'leave_decided',
      'leave_info_requested',
      'handover_requested',
      'absence_reassessment',
    ],
  },
  {
    title: 'Projects and recognition',
    kinds: [
      'project_at_risk',
      'task_overdue_escalated',
      'scope_change_requested',
      'scope_change_decided',
      'reward_updated',
      'reward_review_requested',
    ],
  },
];

/** Kinds added later and not yet placed in a group still reach the digest. */
const OTHER_SECTION = 'Other updates';

export interface DigestItem {
  readonly notificationId: string;
  readonly kind: NotificationKind;
  readonly title: string;
  readonly body: string;
  readonly linkPath: string | null;
  readonly createdAt: Date;
}

export interface DigestEntry extends DigestItem {
  readonly urgency: NotificationUrgency;
}

export interface DigestSection {
  readonly title: string;
  readonly entries: readonly DigestEntry[];
}

export interface EmailDigestPlan {
  readonly sections: readonly DigestSection[];
  /** Every item the digest covers (all of them are marked delivered). */
  readonly total: number;
  /** Items beyond the limit, summarised as "and N more in Lintel". */
  readonly hidden: number;
}

/** A digest longer than this stops being read; the rest is one line and a link. */
export const DIGEST_ENTRY_LIMIT = 40;

const URGENCY_RANK: Readonly<Record<NotificationUrgency, number>> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

function sectionOf(kind: NotificationKind): string {
  return (
    NOTIFICATION_KIND_GROUPS.find((group) => group.kinds.includes(kind))?.title ?? OTHER_SECTION
  );
}

function byUrgencyThenTime(left: DigestEntry, right: DigestEntry): number {
  const rank = URGENCY_RANK[left.urgency] - URGENCY_RANK[right.urgency];
  return rank !== 0 ? rank : left.createdAt.getTime() - right.createdAt.getTime();
}

/**
 * Groups a person's held emails into the daily digest: sections in the usual
 * order, the most pressing items first, sensitive kinds reduced to a generic
 * line. Returns null when there is nothing to send — empty digests are skipped.
 */
export function planEmailDigest(
  items: readonly DigestItem[],
  limit = DIGEST_ENTRY_LIMIT,
): EmailDigestPlan | null {
  if (items.length === 0) return null;
  const entries = items
    .map((item): DigestEntry => {
      const preview = messagePreviewFor(item.kind, item.title, item.body);
      return { ...item, ...preview, urgency: NOTIFICATION_URGENCY[item.kind] };
    })
    .sort(byUrgencyThenTime);
  const shown = entries.slice(0, Math.max(1, limit));
  const order = [...NOTIFICATION_KIND_GROUPS.map((group) => group.title), OTHER_SECTION];
  const sections = order
    .map((title) => ({
      title,
      entries: shown.filter((entry) => sectionOf(entry.kind) === title),
    }))
    .filter((section) => section.entries.length > 0);
  return { sections, total: items.length, hidden: items.length - shown.length };
}
