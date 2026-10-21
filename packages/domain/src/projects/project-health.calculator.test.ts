import { toCalendarDate } from '@lintel/shared';
import { describe, expect, it } from 'vitest';
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
    deliveryForecast: null,
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

  it('reports off track when the forecast passes the planned delivery date', () => {
    const health = defaultProjectHealthCalculator.calculate(
      input({
        plannedEndDate: toCalendarDate('2026-11-02'),
        tasks: [{ status: 'ready', dueDate: toCalendarDate('2026-11-10') }],
        deliveryForecast: { forecastDate: toCalendarDate('2026-11-10'), slipWorkingDays: 6 },
      }),
      today,
    );
    expect(health.status).toBe('off_track');
    expect(health.forecastEndDate).toBe('2026-11-10');
    expect(health.reasons[0]?.message).toBe(
      'Open work is forecast to finish 6 working days past the planned delivery date, on 2026-11-10.',
    );
  });

  it('closes completed projects', () => {
    expect(
      defaultProjectHealthCalculator.calculate(input({ status: 'completed' }), today).status,
    ).toBe('closed');
  });
});
