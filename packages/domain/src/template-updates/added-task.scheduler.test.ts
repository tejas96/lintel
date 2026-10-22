import { toCalendarDate } from '@lintel/shared';
import { describe, expect, it } from 'vitest';
import { DEFAULT_WORKING_CALENDAR } from '../calendar/working-calendar';
import type { WorkflowTemplateDefinition } from '../workflows/workflow-template-definition';
import { scheduleAddedTasks, scheduleAddedWork } from './added-task.scheduler';
import { existingStageSpans } from './stage-spans';
import { NEW_VERSION, PROJECT, templateTask } from './template-update.fixtures';

const base = {
  existingDueByKey: new Map<string, string | null>([
    ['brief', '2026-10-27'],
    ['drawings', '2026-11-03'],
  ]),
  existingStageSpans: existingStageSpans(PROJECT),
  calendar: DEFAULT_WORKING_CALENDAR,
  assignees: new Map([['designer', 'meera']] as const),
};

/** The new version plus a task at the end of Design that waits for nothing. */
const WITH_SAMPLES: WorkflowTemplateDefinition = {
  ...NEW_VERSION,
  stages: NEW_VERSION.stages.map((stage) =>
    stage.key === 'design'
      ? { ...stage, tasks: [...stage.tasks, templateTask('samples', 'Client approves samples')] }
      : stage,
  ),
};

describe('where the project stages sit today', () => {
  it('spans the earliest start to the latest due date of each stage', () => {
    const spans = existingStageSpans(PROJECT);
    expect(spans.get('concept')).toEqual({ start: '2026-10-26', end: '2026-10-30' });
    expect(spans.get('design')).toEqual({ start: '2026-11-02', end: '2026-11-03' });
  });
});

describe('scheduling added tasks', () => {
  it('starts each new task after its prerequisites and never before today', () => {
    const schedule = scheduleAddedTasks({
      ...base,
      definition: NEW_VERSION,
      addedKeys: ['site-photos', 'orders'],
      earliestStart: toCalendarDate('2026-10-29'),
    });
    expect(schedule.get('site-photos')).toEqual({
      plannedStartDate: '2026-10-29',
      dueDate: '2026-10-29',
      ownerUserId: 'meera',
      reviewerUserId: null,
    });
    expect(schedule.get('orders')).toMatchObject({
      plannedStartDate: '2026-11-04',
      dueDate: '2026-11-05',
    });
  });

  it('starts a task without prerequisites when its stage starts, not today', () => {
    const schedule = scheduleAddedTasks({
      ...base,
      definition: WITH_SAMPLES,
      addedKeys: ['samples'],
      earliestStart: toCalendarDate('2026-10-22'),
    });
    expect(schedule.get('samples')).toMatchObject({
      plannedStartDate: '2026-11-02',
      dueDate: '2026-11-03',
    });
  });

  it('keeps a task inside its stage even when its prerequisite finishes earlier', () => {
    const definition: WorkflowTemplateDefinition = {
      ...WITH_SAMPLES,
      stages: WITH_SAMPLES.stages.map((stage) => ({
        ...stage,
        tasks: stage.tasks.map((task) =>
          task.key === 'samples' ? { ...task, dependsOn: ['brief'] } : task,
        ),
      })),
    };
    const schedule = scheduleAddedTasks({
      ...base,
      definition,
      addedKeys: ['samples'],
      earliestStart: toCalendarDate('2026-10-22'),
    });
    expect(schedule.get('samples')?.plannedStartDate).toBe('2026-11-02');
  });

  it('starts a new stage the working day after the previous stage ends', () => {
    const definition: WorkflowTemplateDefinition = {
      ...NEW_VERSION,
      stages: NEW_VERSION.stages.map((stage) =>
        stage.key === 'procurement'
          ? { ...stage, tasks: [templateTask('quotes', 'Collect quotes', { durationDays: 1 })] }
          : stage,
      ),
    };
    const work = scheduleAddedWork({
      ...base,
      definition,
      addedKeys: ['quotes'],
      earliestStart: toCalendarDate('2026-10-22'),
    });
    expect(work.tasks.get('quotes')).toMatchObject({
      plannedStartDate: '2026-11-04',
      dueDate: '2026-11-04',
    });
    expect(work.stageStarts.get('procurement')).toBe('2026-11-04');
    expect(work.stageStarts.get('kickoff')).toBe('2026-10-22');
  });

  it('schedules new tasks that wait for other new tasks after them', () => {
    const definition: WorkflowTemplateDefinition = {
      ...WITH_SAMPLES,
      stages: WITH_SAMPLES.stages.map((stage) =>
        stage.key === 'design'
          ? {
              ...stage,
              tasks: [
                ...stage.tasks,
                templateTask('sign-off', 'Sample sign-off', { dependsOn: ['samples'] }),
              ],
            }
          : stage,
      ),
    };
    const schedule = scheduleAddedTasks({
      ...base,
      definition,
      addedKeys: ['sign-off', 'samples'],
      earliestStart: toCalendarDate('2026-10-22'),
    });
    expect(schedule.get('sign-off')).toMatchObject({
      plannedStartDate: '2026-11-04',
      dueDate: '2026-11-05',
    });
  });

  it('leaves tasks unassigned when nobody holds the role', () => {
    const schedule = scheduleAddedTasks({
      ...base,
      definition: NEW_VERSION,
      addedKeys: ['welcome'],
      existingStageSpans: new Map(),
      earliestStart: toCalendarDate('2026-11-01'),
      assignees: new Map(),
    });
    expect(schedule.get('welcome')).toMatchObject({
      plannedStartDate: '2026-11-02',
      ownerUserId: null,
    });
  });

  it('refuses dependency loops', () => {
    const definition: WorkflowTemplateDefinition = {
      options: [],
      stages: [
        {
          key: 'only',
          name: 'Only',
          milestones: [],
          tasks: [
            templateTask('a', 'A', { dependsOn: ['b'] }),
            templateTask('b', 'B', { dependsOn: ['a'] }),
          ],
        },
      ],
    };
    expect(() =>
      scheduleAddedTasks({
        ...base,
        definition,
        addedKeys: ['a', 'b'],
        earliestStart: toCalendarDate('2026-10-22'),
      }),
    ).toThrow(RangeError);
  });

  it('uses the project snapshot fixture consistently', () => {
    expect(PROJECT.tasks.filter((task) => task.status === 'ready')).toHaveLength(3);
  });
});
