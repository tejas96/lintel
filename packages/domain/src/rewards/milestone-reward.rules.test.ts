import { toCalendarDate } from '@lintel/shared';
import { describe, expect, it } from 'vitest';
import { DEFAULT_WORKING_CALENDAR } from '../calendar/working-calendar';
import { excusedWorkingDays, isOutsidePersonsControl } from './excused-delay';
import { describeMilestoneRewardConditions } from './milestone-reward.conditions';
import {
  assessMilestoneReward,
  formatRewardDate,
  type MilestoneRewardFacts,
} from './milestone-reward.rules';
import { splitMilestoneReward } from './milestone-reward.split';

const date = toCalendarDate;
const ANA = 'ana';

/** Due Monday 2 Nov 2026 (Mon–Sat studio week), everything in order. */
function facts(overrides: Partial<MilestoneRewardFacts> = {}): MilestoneRewardFacts {
  return {
    recipientUserId: ANA,
    agreedDueDate: date('2026-11-02'),
    dueDate: date('2026-11-02'),
    completedOn: date('2026-11-02'),
    deliverables: [
      { name: 'Concept deck', isRequired: true, submitted: true, approved: true },
      { name: 'Mood board', isRequired: false, submitted: false, approved: false },
    ],
    requiredFolders: ['drawings'],
    foldersOnFile: new Set(['drawings']),
    blockers: [],
    calendar: DEFAULT_WORKING_CALENDAR,
    ...overrides,
  };
}

const check = (result: ReturnType<typeof assessMilestoneReward>, type: string) =>
  result.checks.find((item) => item.type === type);

describe('milestone reward rules', () => {
  it('recommends granting when every condition is met', () => {
    const result = assessMilestoneReward(facts());
    expect(result.recommendation).toBe('grant');
    expect(result.checks.map((item) => item.passed)).toEqual([true, true, true, true]);
    expect(check(result, 'on_time')?.explanation).toContain('on or before 2 Nov 2026');
  });

  it('withholds when a required deliverable was never submitted or approved', () => {
    const result = assessMilestoneReward(
      facts({
        deliverables: [
          { name: 'Concept deck', isRequired: true, submitted: false, approved: false },
        ],
      }),
    );
    expect(result.recommendation).toBe('withhold');
    expect(check(result, 'deliverables_submitted')?.explanation).toBe(
      'Not submitted: Concept deck.',
    );
    expect(check(result, 'reviews_passed')?.passed).toBe(false);
    expect(result.summary).toContain('nothing is deducted automatically');
  });

  it('passes deliverable and document checks when nothing was required', () => {
    const result = assessMilestoneReward(
      facts({ deliverables: [], requiredFolders: [], foldersOnFile: new Set() }),
    );
    expect(result.recommendation).toBe('grant');
    expect(check(result, 'deliverables_submitted')?.actual).toBe('None needed');
    expect(check(result, 'documentation')?.explanation).toBe('No documents were required.');
  });

  it('withholds when a required document folder is empty', () => {
    const result = assessMilestoneReward(
      facts({ requiredFolders: ['drawings', 'contracts'], foldersOnFile: new Set(['drawings']) }),
    );
    expect(check(result, 'documentation')?.passed).toBe(false);
    expect(check(result, 'documentation')?.explanation).toContain('Contracts');
  });

  it('measures lateness in working days and uses an approved revision as the deadline', () => {
    const late = assessMilestoneReward(facts({ completedOn: date('2026-11-04') }));
    expect(check(late, 'on_time')?.passed).toBe(false);
    expect(check(late, 'on_time')?.actual).toBe('2 days late');
    const revised = assessMilestoneReward(
      facts({ dueDate: date('2026-11-05'), completedOn: date('2026-11-04') }),
    );
    expect(check(revised, 'on_time')?.passed).toBe(true);
    expect(check(revised, 'on_time')?.explanation).toContain('approved scope change');
    // Saturday 7 Nov is a working day, Sunday 8 Nov is not: Mon 9 Nov is 2 days after Fri 6 Nov.
    const weekend = assessMilestoneReward(
      facts({ dueDate: date('2026-11-06'), completedOn: date('2026-11-09') }),
    );
    expect(check(weekend, 'on_time')?.actual).toBe('2 days late');
  });

  it('does not count waiting on a client, supplier or colleague against the person', () => {
    const result = assessMilestoneReward(
      facts({
        completedOn: date('2026-11-04'),
        blockers: [
          {
            category: 'client',
            waitingOnUserId: null,
            raisedOn: date('2026-10-28'),
            resolvedOn: date('2026-10-30'),
          },
        ],
      }),
    );
    expect(check(result, 'on_time')?.passed).toBe(true);
    expect(check(result, 'on_time')?.actual).toBe('2 days late, 2 excused');
    expect(result.recommendation).toBe('grant');
  });

  it('still counts a delay that waiting only partly explains', () => {
    const result = assessMilestoneReward(
      facts({
        completedOn: date('2026-11-05'),
        blockers: [
          {
            category: 'supplier',
            waitingOnUserId: null,
            raisedOn: date('2026-10-29'),
            resolvedOn: date('2026-10-30'),
          },
        ],
      }),
    );
    expect(check(result, 'on_time')?.passed).toBe(false);
    expect(check(result, 'on_time')?.explanation).toContain('covers only part');
  });
});

describe('who controls a delay', () => {
  const blocker = (category: string, waitingOnUserId: string | null) => ({
    category,
    waitingOnUserId,
    raisedOn: date('2026-11-02'),
    resolvedOn: date('2026-11-04'),
  });

  it('treats clients, suppliers, decisions and named colleagues as outside the person', () => {
    expect(isOutsidePersonsControl(blocker('client', null), ANA)).toBe(true);
    expect(isOutsidePersonsControl(blocker('manager_decision', null), ANA)).toBe(true);
    expect(isOutsidePersonsControl(blocker('internal_dependency', 'dev'), ANA)).toBe(true);
    expect(isOutsidePersonsControl(blocker('internal_dependency', ANA), ANA)).toBe(false);
    expect(isOutsidePersonsControl(blocker('information', null), ANA)).toBe(false);
  });

  it('counts overlapping waits once and skips the resolution day and days off', () => {
    const days = excusedWorkingDays(
      [
        blocker('client', null),
        {
          ...blocker('supplier', null),
          raisedOn: date('2026-11-03'),
          resolvedOn: date('2026-11-09'),
        },
      ],
      ANA,
      DEFAULT_WORKING_CALENDAR,
    );
    // 2–7 Nov (Mon–Sat) are working days; Sunday 8 Nov is not; 9 Nov is the resolution day.
    expect(days).toBe(6);
  });
});

describe('sharing a reward', () => {
  it('splits equally and gives the remainder to the first people, one unit each', () => {
    expect(splitMilestoneReward(500_000, 3)).toEqual([166_667, 166_667, 166_666]);
    expect(splitMilestoneReward(300_000, 3)).toEqual([100_000, 100_000, 100_000]);
    expect(splitMilestoneReward(0, 2)).toEqual([0, 0]);
    expect(splitMilestoneReward(7, 1)).toEqual([7]);
  });

  it('always adds up to the amount', () => {
    for (const [amount, people] of [
      [999_999, 7],
      [1, 4],
      [123_457, 20],
    ] as const) {
      const shares = splitMilestoneReward(amount, people);
      expect(shares.reduce((sum, share) => sum + share, 0)).toBe(amount);
    }
  });

  it('refuses impossible splits', () => {
    expect(() => splitMilestoneReward(100, 0)).toThrow(RangeError);
    expect(() => splitMilestoneReward(-1, 2)).toThrow(RangeError);
    expect(() => splitMilestoneReward(10.5, 2)).toThrow(RangeError);
  });
});

describe('reward dates', () => {
  it('reads like a person writes dates', () => {
    expect(formatRewardDate(date('2026-11-02'))).toBe('2 Nov 2026');
  });
});

describe('what earns a milestone reward', () => {
  it('lists the conditions in words, with documents and sharing when they apply', () => {
    const conditions = describeMilestoneRewardConditions({
      agreedDueDate: date('2026-11-02'),
      requiredFolders: ['drawings', 'contracts'],
      sharedBy: 3,
    });
    expect(conditions).toHaveLength(5);
    expect(conditions[2]).toContain('by 2 Nov 2026');
    expect(conditions[3]).toBe('Drawings and Contracts are in the project documents.');
    expect(conditions[4]).toContain('Shared equally by 3 people');
    expect(
      describeMilestoneRewardConditions({
        agreedDueDate: date('2026-11-02'),
        requiredFolders: [],
        sharedBy: 1,
      }),
    ).toHaveLength(4);
  });
});
