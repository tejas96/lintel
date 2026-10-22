import { describe, expect, it } from 'vitest';
import {
  normaliseTeamDefinition,
  teamArchiveBlocker,
  teamNameKey,
  validateTeamDefinition,
} from './team.rules';

describe('team rules', () => {
  it('accepts a sensible team', () => {
    expect(validateTeamDefinition({ name: 'Design', description: null, leadUserId: null })).toEqual(
      [],
    );
  });

  it('rejects names that are too short or too long, and long descriptions', () => {
    const problems = validateTeamDefinition({
      name: 'D',
      description: 'x'.repeat(301),
      leadUserId: null,
    });
    expect(problems.map((problem) => problem.field)).toEqual(['name', 'description']);
    expect(
      validateTeamDefinition({ name: 'x'.repeat(61), description: null, leadUserId: null }),
    ).toHaveLength(1);
  });

  it('compares names regardless of case and spacing', () => {
    expect(teamNameKey('  Site   Team ')).toBe(teamNameKey('site team'));
    expect(teamNameKey('Design')).not.toBe(teamNameKey('Designs'));
  });

  it('tidies the name and drops an empty description', () => {
    expect(
      normaliseTeamDefinition({ name: '  Site   team ', description: '  ', leadUserId: null }),
    ).toEqual({ name: 'Site team', description: null, leadUserId: null });
  });

  it('blocks archiving while active people are on the team, and says how many', () => {
    expect(teamArchiveBlocker(0)).toBeNull();
    expect(teamArchiveBlocker(1)).toContain('1 person');
    expect(teamArchiveBlocker(4)).toContain('4 people');
  });
});
