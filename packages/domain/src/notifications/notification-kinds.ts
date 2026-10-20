export const NOTIFICATION_KINDS = [
  'task_assigned',
  'task_reassigned',
  'deadline_upcoming',
  'task_overdue',
  'task_overdue_escalated',
  'task_blocked',
  'blocker_resolved',
  'review_requested',
  'review_reminder',
  'review_decided',
  'leave_requested',
  'leave_decided',
  'leave_info_requested',
  'handover_requested',
  'absence_reassessment',
  'project_at_risk',
  'scope_change_requested',
  'scope_change_decided',
  'reward_updated',
  'priority_changed',
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const NOTIFICATION_CHANNELS = ['in_app', 'push', 'sms', 'email'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export type NotificationUrgency = 'low' | 'normal' | 'high' | 'urgent';

export const NOTIFICATION_URGENCY: Readonly<Record<NotificationKind, NotificationUrgency>> = {
  task_assigned: 'normal',
  task_reassigned: 'normal',
  deadline_upcoming: 'normal',
  task_overdue: 'high',
  task_overdue_escalated: 'high',
  task_blocked: 'high',
  blocker_resolved: 'normal',
  review_requested: 'normal',
  review_reminder: 'normal',
  review_decided: 'normal',
  leave_requested: 'normal',
  leave_decided: 'normal',
  leave_info_requested: 'normal',
  handover_requested: 'high',
  absence_reassessment: 'urgent',
  project_at_risk: 'high',
  scope_change_requested: 'normal',
  scope_change_decided: 'normal',
  reward_updated: 'low',
  priority_changed: 'normal',
};

/**
 * Kinds whose details must never appear on a lock screen. Push previews for
 * these use a generic sentence; the full text is visible only in the app.
 */
export const SENSITIVE_NOTIFICATION_KINDS: ReadonlySet<NotificationKind> = new Set([
  'reward_updated',
  'leave_decided',
  'leave_info_requested',
]);
