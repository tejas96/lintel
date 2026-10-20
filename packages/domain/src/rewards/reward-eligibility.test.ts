import { toCalendarDate } from '@lintel/shared';
import { describe, expect, it } from 'vitest';
import { evaluateRewardEligibility } from './reward-eligibility.strategy';
import { buildRewardMetrics, type TaskOutcomeFact, wasDeliveredOnTime } from './reward-metrics';

const date = toCalendarDate;

function outcome(overrides: Partial<TaskOutcomeFact>): TaskOutcomeFact {
  return {
    taskId: 't',
    isOwner: true,
    completedOn: date('2026-10-10'),
    effectiveDueDate: date('2026-10-10'),
    externalBlockedDays: 0,
    wasReviewed: true,
    reviewRounds: 0,
    checklistCompleteAtFinish: true,
    ...overrides,
  };
}

describe('reward metrics', () => {
  it('does not count client waiting time against the person', () => {
    expect(
      wasDeliveredOnTime(outcome({ completedOn: date('2026-10-12'), externalBlockedDays: 2 })),
    ).toBe(true);
    expect(
      wasDeliveredOnTime(outcome({ completedOn: date('2026-10-12'), externalBlockedDays: 1 })),
    ).toBe(false);
  });
});

describe('reward eligibility', () => {
  const criteria = [
    { type: 'on_time_delivery_rate', minimumRate: 0.9, minimumTasks: 4 } as const,
    { type: 'first_pass_approval_rate', minimumRate: 0.75, minimumReviews: 2 } as const,
  ];

  it('is eligible when every criterion passes, with explanations', () => {
    const metrics = buildRewardMetrics({
      outcomes: Array.from({ length: 5 }, (_, index) => outcome({ taskId: `t${index}` })),
      blockerReports: [],
      milestonesDeliveredOnTime: 1,
      previousOnTimeRate: null,
    });
    const result = evaluateRewardEligibility(criteria, metrics);
    expect(result.eligible).toBe(true);
    expect(result.criteria[0]?.explanation).toBe(
      '5 of 5 owned tasks were on time (100%); needs 90%.',
    );
  });

  it('refuses to judge with too little data', () => {
    const metrics = buildRewardMetrics({
      outcomes: [outcome({})],
      blockerReports: [],
      milestonesDeliveredOnTime: 0,
      previousOnTimeRate: null,
    });
    const result = evaluateRewardEligibility(criteria, metrics);
    expect(result.eligible).toBe(false);
    expect(result.criteria[0]?.explanation).toContain('at least 4 are needed');
  });

  it('treats an empty policy as never eligible', () => {
    const metrics = buildRewardMetrics({
      outcomes: [],
      blockerReports: [],
      milestonesDeliveredOnTime: 0,
      previousOnTimeRate: null,
    });
    expect(evaluateRewardEligibility([], metrics).eligible).toBe(false);
  });
});
