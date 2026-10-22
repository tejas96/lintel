import type { ChallengeEntry, MilestoneRewardShare, RewardEvaluation } from '@lintel/api-contracts';
import { describe, expect, it } from 'vitest';
import { formatAmount } from '@/formatting/money';
import { challengeOutcome } from './challenge-outcome';
import {
  findRewardRecord,
  formatRewardPeriod,
  groupRewardRecords,
  payableAmount,
} from './reward-records';

const PERSON = {
  id: '9f5238fa-7b2e-4015-846a-340fa7f999a2',
  fullName: 'Ananya Joshi',
  designation: null,
  role: 'employee' as const,
  avatarHue: 12,
  status: 'active' as const,
};

function evaluation(overrides: Partial<RewardEvaluation>): RewardEvaluation {
  return {
    id: 'e1',
    policy: { id: 'p1', name: 'Reliable delivery bonus', scope: 'individual' },
    user: PERSON,
    team: null,
    periodStart: '2026-10-01',
    periodEnd: '2026-10-31',
    status: 'pending_review',
    summary: 'Every criterion was met.',
    criteria: [],
    amountMinor: 300_000,
    adjustedAmountMinor: null,
    adjustmentReason: null,
    currency: 'INR',
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
    createdAt: '2026-10-21T08:45:19.384Z',
    challenges: [],
    challengeable: { allowed: false, reason: null },
    version: 1,
    ...overrides,
  };
}

function share(overrides: Partial<MilestoneRewardShare>): MilestoneRewardShare {
  return {
    id: 's1',
    planId: 'plan1',
    project: { id: 'pr1', reference: 'ARN-2026-001', name: 'Saska Residence', colorIndex: 0 },
    milestone: {
      id: 'm1',
      name: 'Design frozen',
      dueDate: '2026-10-22',
      status: 'pending',
      completedAt: null,
    },
    scope: 'team',
    sharedBy: 2,
    agreedDueDate: '2026-10-22',
    conditions: ['Every required deliverable is submitted.'],
    note: null,
    user: PERSON,
    status: 'planned',
    recommendation: null,
    summary: null,
    criteria: [],
    totalAmountMinor: 500_001,
    shareAmountMinor: 250_001,
    pool: null,
    adjustedAmountMinor: null,
    adjustmentReason: null,
    currency: 'INR',
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
    challenges: [],
    challengeable: { allowed: false, reason: null },
    version: 1,
    ...overrides,
  };
}

describe('reward records', () => {
  it('names a month or a quarter', () => {
    expect(formatRewardPeriod('2026-10-01', '2026-10-31')).toBe('October 2026');
    expect(formatRewardPeriod('2026-10-01', '2026-12-31')).toBe('October to December 2026');
    expect(formatRewardPeriod('2026-12-01', '2027-02-28')).toBe('December 2026 to February 2027');
  });

  it('splits planned, waiting and decided records, newest decision first', () => {
    const sections = groupRewardRecords(
      [
        evaluation({ id: 'waiting' }),
        evaluation({ id: 'older', status: 'approved', decidedAt: '2026-09-02T10:00:00Z' }),
        evaluation({ id: 'ineligible', status: 'ineligible', createdAt: '2026-08-01T00:00:00Z' }),
      ],
      [
        share({ id: 'later', agreedDueDate: '2026-11-30' }),
        share({ id: 'sooner', agreedDueDate: '2026-10-24' }),
        share({ id: 'decided', status: 'rejected', decidedAt: '2026-10-21T08:49:28Z' }),
      ],
    );
    expect(sections.planned.map((item) => item.id)).toEqual(['sooner', 'later']);
    expect(sections.waiting.map((item) => item.id)).toEqual(['waiting']);
    expect(sections.decided.map((item) => item.id)).toEqual(['decided', 'older', 'ineligible']);
  });

  it('pays the adjusted amount when a reviewer changed it, and hides what the API hid', () => {
    const [adjusted] = groupRewardRecords(
      [],
      [share({ status: 'approved', adjustedAmountMinor: 200_000 })],
    ).decided;
    expect(adjusted?.context).toBe('ARN-2026-001 · Saska Residence');
    expect(adjusted && payableAmount(adjusted)).toBe(200_000);
    const [hidden] = groupRewardRecords([evaluation({ amountMinor: null })], []).waiting;
    expect(hidden && payableAmount(hidden)).toBeNull();
  });

  it('finds the record a challenge is about, and nothing for planned or unknown ones', () => {
    const evaluations = [evaluation({ id: 'e9', status: 'rejected' })];
    const shares = [share({ id: 's9' }), share({ id: 's10', status: 'approved' })];
    expect(findRewardRecord('evaluation', 'e9', evaluations, shares)?.title).toBe('October 2026');
    expect(findRewardRecord('milestone', 's10', evaluations, shares)?.title).toBe('Design frozen');
    expect(findRewardRecord('milestone', 's9', evaluations, shares)).toBeNull();
    expect(findRewardRecord('task', 'e9', evaluations, shares)).toBeNull();
  });
});

describe('challenge outcome', () => {
  const challenge = (after: ChallengeEntry['after']): ChallengeEntry => ({
    id: 'c1',
    status: after ? 'corrected' : 'open',
    reason: 'The deliverable went by email.',
    raisedBy: PERSON,
    createdAt: '2026-10-21T09:00:00Z',
    before: { status: 'rejected', grantedAmountMinor: null, decisionNote: null },
    after,
    resolvedBy: null,
    resolvedAt: null,
    resolutionNote: null,
    version: 1,
  });

  it('says what changed, or that the record stood', () => {
    expect(challengeOutcome(challenge(null), 'INR')).toBeNull();
    expect(
      challengeOutcome(
        challenge({ status: 'approved', grantedAmountMinor: 300_000, decisionNote: null }),
        'INR',
      ),
    ).toBe('Not approved → Approved, ₹3,000');
    expect(
      challengeOutcome(
        challenge({ status: 'rejected', grantedAmountMinor: null, decisionNote: null }),
        'INR',
      ),
    ).toBe('Unchanged: Not approved');
  });

  it('formats rupees from paise, with paise only when there are some', () => {
    expect(formatAmount(300_000, 'INR')).toBe('₹3,000');
    expect(formatAmount(436_800_000, 'INR')).toBe('₹43,68,000');
    expect(formatAmount(250_001, 'INR')).toBe('₹2,500.01');
  });
});
