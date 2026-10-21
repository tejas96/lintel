import { DEFAULT_WORKING_CALENDAR } from '@lintel/domain';
import { describe, expect, it } from 'vitest';
import type {
  ProjectScheduleFacts,
  ScopeChangeNewTask,
  ScopeStageFact,
} from './scope-change.store';
import {
  assessScopeChange,
  isEmptyScopeChange,
  type ScopeChangeRequest,
  scopeChangeAdditionIssues,
} from './scope-change-additions';

const facts: ProjectScheduleFacts = {
  projectId: 'p1',
  name: 'Kiln & Co. Café',
  plannedEndDate: '2026-10-28',
  tasks: [
    {
      id: 'a',
      title: 'Counter drawings',
      status: 'in_progress',
      plannedStartDate: '2026-10-21',
      dueDate: '2026-10-23',
      ownerUserId: 'u1',
      milestoneId: null,
    },
    {
      id: 'b',
      title: 'Joinery',
      status: 'ready',
      plannedStartDate: '2026-10-26',
      dueDate: '2026-10-28',
      ownerUserId: 'u2',
      milestoneId: null,
    },
    {
      id: 'c',
      title: 'Signage',
      status: 'in_review',
      plannedStartDate: '2026-10-20',
      dueDate: '2026-10-22',
      ownerUserId: 'u1',
      milestoneId: null,
    },
    {
      id: 'd',
      title: 'Survey',
      status: 'done',
      plannedStartDate: '2026-10-19',
      dueDate: '2026-10-20',
      ownerUserId: 'u1',
      milestoneId: null,
    },
  ],
  dependencies: [{ taskId: 'b', dependsOnTaskId: 'a' }],
  milestones: [],
};

const stages: ScopeStageFact[] = [
  { id: 's-open', name: 'Execution', status: 'active' },
  { id: 's-done', name: 'Design', status: 'completed' },
];

const extraTask: ScopeChangeNewTask = {
  title: 'Add a reading nook',
  stageId: 's-open',
  plannedStartDate: '2026-10-29',
  dueDate: '2026-11-02',
  ownerUserId: 'u2',
  priority: 'medium',
};

function request(overrides: Partial<ScopeChangeRequest>): ScopeChangeRequest {
  return { taskShifts: [], newTasks: [], cancelTaskIds: [], ...overrides };
}

describe('scope changes that add and cancel tasks: rules', () => {
  it('accepts new tasks in open stages and cancellations of open work', () => {
    expect(
      scopeChangeAdditionIssues(
        facts,
        stages,
        request({ newTasks: [extraTask], cancelTaskIds: ['b'] }),
      ),
    ).toEqual([]);
  });

  it('refuses closed stages and back-to-front dates for new tasks', () => {
    const issues = scopeChangeAdditionIssues(
      facts,
      stages,
      request({ newTasks: [{ ...extraTask, stageId: 's-done', plannedStartDate: '2026-11-05' }] }),
    );
    expect(issues.map((issue) => issue.field)).toEqual([
      'newTasks.0.stageId',
      'newTasks.0.plannedStartDate',
    ]);
  });

  it('cancels only open project tasks that are not waiting for review, once, and not also moved', () => {
    const issues = scopeChangeAdditionIssues(
      facts,
      stages,
      request({
        taskShifts: [{ taskId: 'a', shiftWorkingDays: 2 }],
        cancelTaskIds: ['x', 'b', 'b', 'c', 'd', 'a'],
      }),
    );
    expect(issues.map((issue) => issue.message)).toEqual([
      'This task is not part of the project.',
      'This task is listed more than once.',
      '"Signage" is waiting for review. Decide the review first.',
      '"Survey" is already done.',
      '"Counter drawings" is also being moved. Either move it or cancel it.',
    ]);
  });

  it('treats a change with nothing in it as empty', () => {
    expect(isEmptyScopeChange(request({}))).toBe(true);
    expect(isEmptyScopeChange(request({ cancelTaskIds: ['b'] }))).toBe(false);
  });
});

describe('scope changes that add and cancel tasks: impact', () => {
  it('counts new tasks towards the project end', () => {
    const result = assessScopeChange(
      facts,
      request({ newTasks: [extraTask] }),
      DEFAULT_WORKING_CALENDAR,
    );
    expect(result.forecastEndDate).toBe('2026-11-02');
    expect(result.projectEndImpactDays).toBe(4);
  });

  it('stops counting cancelled tasks, so cancelling the last task can pull the forecast in', () => {
    const result = assessScopeChange(
      facts,
      request({ cancelTaskIds: ['b'] }),
      DEFAULT_WORKING_CALENDAR,
    );
    expect(result.forecastEndDate).toBe('2026-10-23');
    expect(result.projectEndImpactDays).toBe(0);
  });

  it('keeps moving downstream tasks with the moves alongside additions', () => {
    const result = assessScopeChange(
      facts,
      request({ taskShifts: [{ taskId: 'a', shiftWorkingDays: 2 }], newTasks: [extraTask] }),
      DEFAULT_WORKING_CALENDAR,
    );
    expect(result.impacts.map((impact) => [impact.taskId, impact.proposedDueDate])).toEqual([
      ['a', '2026-10-26'],
      ['b', '2026-10-30'],
    ]);
    expect(result.forecastEndDate).toBe('2026-11-02');
  });
});
