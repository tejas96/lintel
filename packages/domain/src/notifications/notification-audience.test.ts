import { describe, expect, it } from 'vitest';
import { DEFAULT_ROLE_CAPABILITIES } from '../identity/capabilities';
import { receivableNotificationKinds } from './notification-audience';
import { NOTIFICATION_KINDS } from './notification-kinds';

const capabilitiesOf = (role: keyof typeof DEFAULT_ROLE_CAPABILITIES) =>
  new Set(DEFAULT_ROLE_CAPABILITIES[role]);

describe('receivableNotificationKinds', () => {
  it('hides manager-only kinds from an employee who manages nothing', () => {
    const kinds = receivableNotificationKinds({
      capabilities: capabilitiesOf('employee'),
      managesProjects: false,
    });
    expect(kinds).toContain('task_assigned');
    expect(kinds).toContain('handover_requested');
    for (const managerOnly of [
      'leave_requested',
      'task_overdue_escalated',
      'reward_review_requested',
      'reassignment_requested',
      'date_change_requested',
      'scope_change_requested',
      'absence_reassessment',
    ] as const) {
      expect(kinds).not.toContain(managerOnly);
    }
  });

  it('shows project-manager kinds to anyone who manages a project', () => {
    const kinds = receivableNotificationKinds({
      capabilities: capabilitiesOf('employee'),
      managesProjects: true,
    });
    expect(kinds).toContain('date_change_requested');
    expect(kinds).not.toContain('leave_requested');
  });

  it('gives the owner every kind', () => {
    const kinds = receivableNotificationKinds({
      capabilities: capabilitiesOf('owner'),
      managesProjects: false,
    });
    expect(kinds).toEqual([...NOTIFICATION_KINDS]);
  });
});
