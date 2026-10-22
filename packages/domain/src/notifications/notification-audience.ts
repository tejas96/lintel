import type { Capability } from '../identity/capabilities';
import { NOTIFICATION_KINDS, type NotificationKind } from './notification-kinds';

/**
 * Who can ever receive a kind of notification. `everyone`: anyone can own,
 * review or cover work. `project_managers`: whoever manages or owns a project,
 * or has studio-wide project rights. A capability list: anyone holding one of
 * them. Settings screens use this so people only see rows that can reach them.
 */
export type NotificationAudience =
  | 'everyone'
  | 'project_managers'
  | { readonly anyOf: readonly Capability[] };

export const NOTIFICATION_AUDIENCE: Readonly<Record<NotificationKind, NotificationAudience>> = {
  task_assigned: 'everyone',
  task_reassigned: 'everyone',
  deadline_upcoming: 'everyone',
  task_overdue: 'everyone',
  task_overdue_escalated: 'project_managers',
  task_blocked: 'everyone',
  blocker_resolved: 'everyone',
  review_requested: 'everyone',
  review_reminder: 'everyone',
  review_decided: 'everyone',
  leave_requested: { anyOf: ['leave.approve_team', 'leave.approve_any'] },
  leave_decided: 'everyone',
  leave_info_requested: 'everyone',
  handover_requested: 'everyone',
  absence_reassessment: 'project_managers',
  project_at_risk: 'everyone',
  scope_change_requested: { anyOf: ['scope_changes.approve'] },
  scope_change_decided: 'everyone',
  reward_updated: 'everyone',
  reward_review_requested: { anyOf: ['rewards.decide'] },
  priority_changed: 'everyone',
  reassignment_requested: 'project_managers',
  reassignment_decided: 'everyone',
  task_late_start: 'everyone',
  date_change_requested: 'project_managers',
  date_change_decided: 'everyone',
};

export interface NotificationAudienceFacts {
  readonly capabilities: ReadonlySet<Capability>;
  /** Manages or owns at least one project that is not closed. */
  readonly managesProjects: boolean;
}

export function canReceiveNotification(
  kind: NotificationKind,
  facts: NotificationAudienceFacts,
): boolean {
  const audience = NOTIFICATION_AUDIENCE[kind];
  if (audience === 'everyone') return true;
  if (audience === 'project_managers') {
    return facts.managesProjects || facts.capabilities.has('projects.manage_any');
  }
  return audience.anyOf.some((capability) => facts.capabilities.has(capability));
}

/** The kinds this person can receive, in the canonical order. */
export function receivableNotificationKinds(facts: NotificationAudienceFacts): NotificationKind[] {
  return NOTIFICATION_KINDS.filter((kind) => canReceiveNotification(kind, facts));
}
