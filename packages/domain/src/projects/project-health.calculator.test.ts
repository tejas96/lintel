import { toCalendarDate } from '@lintel/shared';
import { describe, expect, it } from 'vitest';
import { assessMilestoneRisk } from './milestone-risk';
import {
  defaultProjectHealthCalculator,
  type ProjectHealthInput,
} from './project-health.calculator';

const today = toCalendarDate('2026-10-21');

function input(overrides: Partial<ProjectHealthInput>): ProjectHealthInput {
  return {
    status: 'active',
    plannedEndDate: toCalendarDate('2026-12-31'),
    tasks: [],
    milestoneHealth: [],
    openBlockerAgesInDays: [],
    ...overrides,
  };
}

describe('project health', () => {
  it('reports on track when nothing is late', () => {
    const health = defaultProjectHealthCalculator.calculate(
      input({ tasks: [{ status: 'in_progress', dueDate: toCalendarDate('2026-10-30') }] }),
      today,
    );
    expect(health.status).toBe('on_track');
  });

  it('reports at risk for a single overdue task', () => {
    const health = defaultProjectHealthCalculator.calculate(
      input({
        tasks: [
          { status: 'ready', dueDate: toCalendarDate('2026-10-20') },
          ...Array.from({ length: 9 }, () => ({ status: 'ready' as const, dueDate: null })),
        ],
      }),
      today,
    );
    expect(health.status).toBe('at_risk');
    expect(health.overdueTaskCount).toBe(1);
  });

  it('reports off track when work runs past the planned delivery date', () => {
    const health = defaultProjectHealthCalculator.calculate(
      input({
        plannedEndDate: toCalendarDate('2026-11-01'),
        tasks: [{ status: 'ready', dueDate: toCalendarDate('2026-11-10') }],
      }),
      today,
    );
    expect(health.status).toBe('off_track');
    expect(health.reasons[0]?.message).toContain('9 day(s) past');
  });

  it('closes completed projects', () => {
    expect(
      defaultProjectHealthCalculator.calculate(input({ status: 'completed' }), today).status,
    ).toBe('closed');
  });
});

describe('milestone risk', () => {
  const milestone = { name: 'Concept sign-off', status: 'pending' as const };

  it('flags blocked work close to the milestone', () => {
    const result = assessMilestoneRisk(
      {
        ...milestone,
        dueDate: toCalendarDate('2026-10-24'),
        tasks: [{ title: 'Mood board', status: 'blocked', dueDate: toCalendarDate('2026-10-23') }],
      },
      today,
    );
    expect(result.health).toBe('at_risk');
  });

  it('marks a past-due incomplete milestone as missed', () => {
    const result = assessMilestoneRisk(
      { ...milestone, dueDate: toCalendarDate('2026-10-18'), tasks: [] },
      today,
    );
    expect(result.health).toBe('missed');
  });
});
