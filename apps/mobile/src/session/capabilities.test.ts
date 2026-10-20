import type { CurrentUser } from '@lintel/api-contracts';
import { DEFAULT_ROLE_CAPABILITIES, type Role } from '@lintel/domain';
import { describe, expect, it } from 'vitest';
import { visibleTabs } from './capabilities';

function userWithRole(role: Role): CurrentUser {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    fullName: 'Test Person',
    designation: null,
    role,
    avatarHue: 0,
    status: 'active',
    maskedPhone: '+91 •••••• 0000',
    email: null,
    teamId: null,
    capabilities: [...DEFAULT_ROLE_CAPABILITIES[role]],
    organizationName: 'Studio',
    timeZone: 'Asia/Kolkata',
    aiFeaturesEnabled: false,
  };
}

describe('visibleTabs', () => {
  it('gives designers their day, projects, leave and inbox', () => {
    expect([...visibleTabs(userWithRole('employee'))].sort()).toEqual(
      ['inbox', 'index', 'leave', 'projects'].sort(),
    );
  });

  it('gives site supervisors the Site tab', () => {
    expect(visibleTabs(userWithRole('site_supervisor')).has('site')).toBe(true);
    expect(visibleTabs(userWithRole('site_supervisor')).has('approvals')).toBe(false);
  });

  it('gives reviewers Approvals and keeps the bar to five tabs', () => {
    for (const role of ['team_lead', 'project_manager', 'owner'] as const) {
      const tabs = visibleTabs(userWithRole(role));
      expect(tabs.has('approvals')).toBe(true);
      expect(tabs.size).toBeLessThanOrEqual(5);
    }
  });
});
