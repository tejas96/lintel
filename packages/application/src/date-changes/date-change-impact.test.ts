import { DEFAULT_WORKING_CALENDAR } from '@lintel/domain';
import { describe, expect, it } from 'vitest';
import type { ProjectScheduleFacts, ScheduleTaskFact } from '../scope-changes/scope-change.store';
import type { DateChangeRequestRecord } from './date-change.store';
import { acceptedStartDate, dateChangeImpact } from './date-change-impact';

function task(
  id: string,
  start: string,
  due: string,
  extra: Partial<ScheduleTaskFact> = {},
): ScheduleTaskFact {
  return {
    id,
    title: id,
    status: 'ready',
    plannedStartDate: start,
    dueDate: due,
    ownerUserId: 'priya',
    milestoneId: null,
    ...extra,
  };
}

/** Space planning feeds the concept presentation, which closes the concept milestone. */
const facts: ProjectScheduleFacts = {
  projectId: 'p1',
  name: 'Mehta Residence',
  plannedEndDate: '2026-11-04',
  tasks: [
    task('space-planning', '2026-10-26', '2026-10-28'),
    task('presentation', '2026-10-29', '2026-10-29', { milestoneId: 'concept' }),
    task('drawings', '2026-10-30', '2026-11-04'),
    task('lighting', '2026-11-02', '2026-11-02', { status: 'done' }),
  ],
  dependencies: [
    { taskId: 'presentation', dependsOnTaskId: 'space-planning' },
    { taskId: 'drawings', dependsOnTaskId: 'presentation' },
  ],
  milestones: [{ id: 'concept', name: 'Concept approved', dueDate: '2026-10-29', status: 'pending' }],
};

function request(proposedDueDate: string): DateChangeRequestRecord {
  return {
    id: 'r1',
    taskId: 'space-planning',
    projectId: 'p1',
    requestedByUserId: 'priya',
    previousStartDate: '2026-10-26',
    previousDueDate: '2026-10-28',
    proposedStartDate: null,
    proposedDueDate,
    reason: 'Client asked for a third option',
    status: 'open',
    decidedByUserId: null,
    decisionNote: null,
    version: 1,
  };
}

describe('the impact of accepting a new date', () => {
  it('names the waiting task that would start too early, the knock-on and what slips', () => {
    const impact = dateChangeImpact(facts, request('2026-10-30'), DEFAULT_WORKING_CALENDAR);
    expect(impact.waitingTasks.map((waiting) => waiting.taskId)).toEqual(['presentation']);
    expect(impact.dependentMoves.map((move) => [move.taskId, move.proposedDueDate])).toEqual([
      ['presentation', '2026-10-31'],
      ['drawings', '2026-11-06'],
    ]);
    expect(impact.slippingMilestones).toEqual([
      {
        id: 'concept',
        name: 'Concept approved',
        dueDate: '2026-10-29',
        forecastDueDate: '2026-10-31',
        slipWorkingDays: 2,
      },
    ]);
    expect(impact).toMatchObject({
      currentForecastEndDate: '2026-11-04',
      forecastEndDate: '2026-11-06',
      forecastShiftWorkingDays: 2,
      projectEndImpactDays: 2,
      movingWaitingTasksNeedsScopeChange: true,
    });
  });

  it('reports nothing when the new date leaves room before the waiting work', () => {
    const impact = dateChangeImpact(facts, request('2026-10-27'), DEFAULT_WORKING_CALENDAR);
    expect(impact.waitingTasks).toEqual([]);
    expect(impact.dependentMoves).toEqual([]);
    expect(impact.slippingMilestones).toEqual([]);
    expect(impact.forecastShiftWorkingDays).toBe(0);
  });

  it('has no impact for a task that is already closed', () => {
    const closed = {
      ...facts,
      tasks: facts.tasks.map((entry) =>
        entry.id === 'space-planning' ? { ...entry, status: 'done' as const } : entry,
      ),
    };
    const impact = dateChangeImpact(closed, request('2026-10-30'), DEFAULT_WORKING_CALENDAR);
    expect(impact.dependentMoves).toEqual([]);
    expect(impact.forecastEndDate).toBe('2026-11-04');
  });

  it('keeps the current start unless it now falls after the new due date', () => {
    expect(acceptedStartDate(request('2026-10-30'), { plannedStartDate: '2026-10-26' })).toBe(
      '2026-10-26',
    );
    expect(acceptedStartDate(request('2026-10-23'), { plannedStartDate: '2026-10-26' })).toBe(
      '2026-10-23',
    );
  });
});
