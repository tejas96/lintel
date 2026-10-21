import { describe, expect, it } from 'vitest';
import { DEFAULT_ROLE_CAPABILITIES } from '../identity/capabilities';
import {
  GUIDANCE_TIP_KEYS,
  guidanceAudienceFor,
  guidanceTipFor,
  isGuidanceTipKey,
} from './guidance-tips';

const audienceOf = (role: keyof typeof DEFAULT_ROLE_CAPABILITIES) =>
  guidanceAudienceFor(new Set(DEFAULT_ROLE_CAPABILITIES[role]));

describe('first-run guidance', () => {
  it('speaks to people by what they may do', () => {
    expect(audienceOf('owner')).toBe('owner');
    expect(audienceOf('administrator')).toBe('owner');
    expect(audienceOf('project_manager')).toBe('manager');
    expect(audienceOf('team_lead')).toBe('manager');
    expect(audienceOf('employee')).toBe('member');
    expect(audienceOf('site_supervisor')).toBe('member');
  });

  it('has a short tip for every screen a person can open', () => {
    for (const key of ['today', 'task', 'control_room', 'leave'] as const) {
      for (const audience of ['member', 'manager', 'owner'] as const) {
        const tip = guidanceTipFor(key, audience);
        expect(tip?.title.length).toBeGreaterThan(0);
        expect(tip?.body.length).toBeLessThanOrEqual(140);
      }
    }
  });

  it('greets only managers and owners on the command center', () => {
    expect(guidanceTipFor('command_center', 'member')).toBeNull();
    expect(guidanceTipFor('command_center', 'owner')?.title).toBe('The studio at a glance');
  });

  it('knows its keys', () => {
    expect(GUIDANCE_TIP_KEYS.every(isGuidanceTipKey)).toBe(true);
    expect(isGuidanceTipKey('settings')).toBe(false);
  });
});
