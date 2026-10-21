import { toCalendarDate } from '@lintel/shared';
import { describe, expect, it } from 'vitest';
import { DEFAULT_WORKING_CALENDAR } from '../calendar/working-calendar';
import { scheduleAddedTasks } from './added-task.scheduler';
import {
  fieldsToApply,
  itemWillApply,
  planTemplateUpdate,
  presentTemplateUpdatePlan,
} from './template-update.diff';
import { NEW_VERSION, PROJECT, UPDATE_INPUT } from './template-update.fixtures';
import type { TemplateItemChange } from './template-update.types';

const plan = planTemplateUpdate(UPDATE_INPUT);

function item(key: string): TemplateItemChange {
  const found = plan.items.find((candidate) => candidate.key === key);
  if (!found) throw new Error(`No change for ${key}`);
  return found;
}

const nothingTicked = new Set<string>();

describe('template update preview: added items', () => {
  it('adds new tasks, stages and milestones where work can still take them', () => {
    expect(item('task:site-photos')).toMatchObject({ change: 'added', blocked: null, optIn: null });
    expect(item('stage:procurement')).toMatchObject({ change: 'added', blocked: null });
    expect(item('milestone:orders-placed')).toMatchObject({ change: 'added', blocked: null });
    expect(item('task:orders')).toMatchObject({ change: 'added', blocked: null });
    expect(itemWillApply(item('task:site-photos'), nothingTicked)).toBe(true);
  });

  it('never puts a new stage in front of a stage that has started', () => {
    expect(item('stage:kickoff').blocked?.reason).toBe(
      'It would come before stages that have already started.',
    );
    expect(item('task:welcome').blocked?.reason).toBe('Its stage cannot take new work.');
    expect(itemWillApply(item('stage:kickoff'), new Set(['stage:kickoff']))).toBe(false);
  });
});

describe('template update preview: changed items', () => {
  it('applies changes to work that has not started', () => {
    const drawings = item('task:drawings');
    expect(fieldsToApply(drawings, nothingTicked).map((field) => field.field)).toEqual([
      'checklist',
    ]);
    expect(drawings.fields.find((field) => field.field === 'checklist')?.added).toEqual([
      'Check ceiling heights',
    ]);
  });

  it('keeps what this project changed itself', () => {
    const title = item('task:drawings').fields.find((field) => field.field === 'title');
    expect(title).toMatchObject({
      from: 'Drawings for the joiner',
      to: 'Detailed drawings',
      outcome: 'kept',
    });
  });

  it('holds changes to started work until the manager ticks them', () => {
    const brief = item('task:brief');
    expect(brief.optIn?.reason).toContain('Work has started');
    expect(fieldsToApply(brief, nothingTicked)).toEqual([]);
    expect(fieldsToApply(brief, new Set(['task:brief'])).map((field) => field.field)).toEqual([
      'title',
    ]);
  });

  it('holds committed dates and shows where they would move', () => {
    const mood = item('task:moodboard');
    expect(mood.fields).toEqual([
      expect.objectContaining({ field: 'duration', from: '3', to: '5', outcome: 'held' }),
    ]);
    expect(mood.dates).toEqual({
      fromStart: '2026-10-28',
      fromDue: '2026-10-30',
      toStart: '2026-10-28',
      toDue: '2026-11-02',
    });
    expect(itemWillApply(mood, nothingTicked)).toBe(false);
    expect(itemWillApply(mood, new Set([mood.key]))).toBe(true);
  });

  it('never changes finished work, even when ticked', () => {
    const handover = item('task:handover');
    expect(handover.blocked?.reason).toBe('Finished work stays as it was recorded.');
    expect(fieldsToApply(handover, new Set([handover.key]))).toEqual([]);
  });

  it('applies renames to stages that have not started and holds them on started ones', () => {
    expect(item('stage:design').fields).toEqual([
      expect.objectContaining({ field: 'name', to: 'Design development', outcome: 'apply' }),
    ]);
    expect(item('milestone:concept-ok').fields[0]).toMatchObject({
      field: 'name',
      outcome: 'apply',
    });
  });
});

describe('template update preview: removed items', () => {
  it('cancels removed tasks only when they have not started', () => {
    expect(item('task:specs')).toMatchObject({ change: 'removed', optIn: null, blocked: null });
    expect(item('task:lighting').optIn?.reason).toBe('Work has started. Tick to cancel it anyway.');
    expect(item('task:review-pack').blocked?.reason).toContain('waiting for review');
    expect(itemWillApply(item('task:lighting'), nothingTicked)).toBe(false);
    expect(itemWillApply(item('task:lighting'), new Set(['task:lighting']))).toBe(true);
  });

  it('counts what stays the same', () => {
    expect(plan.unchanged).toEqual({ stages: 1, milestones: 0, tasks: 0 });
  });
});

describe('presenting the plan', () => {
  it('shows names instead of template keys', () => {
    const presented = presentTemplateUpdatePlan(
      {
        items: [
          {
            ...item('task:specs'),
            change: 'changed',
            fields: [
              {
                field: 'stage',
                from: 'design',
                to: 'procurement',
                added: [],
                removed: [],
                outcome: 'apply',
              },
              {
                field: 'prerequisites',
                from: null,
                to: null,
                added: ['brief'],
                removed: [],
                outcome: 'apply',
              },
            ],
          },
        ],
        unchanged: plan.unchanged,
      },
      UPDATE_INPUT,
    );
    expect(presented.items[0]?.fields).toEqual([
      expect.objectContaining({ from: 'Design', to: 'Procurement' }),
      expect.objectContaining({ added: ['Capture the brief'] }),
    ]);
  });
});

describe('scheduling added tasks', () => {
  it('starts each new task after its prerequisites and never before today', () => {
    const schedule = scheduleAddedTasks({
      definition: NEW_VERSION,
      addedKeys: ['site-photos', 'orders'],
      existingDueByKey: new Map([
        ['brief', '2026-10-27'],
        ['drawings', '2026-11-03'],
      ]),
      earliestStart: toCalendarDate('2026-10-29'),
      calendar: DEFAULT_WORKING_CALENDAR,
      assignees: new Map([['designer', 'meera']]),
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

  it('leaves tasks unassigned when nobody holds the role', () => {
    const schedule = scheduleAddedTasks({
      definition: NEW_VERSION,
      addedKeys: ['welcome'],
      existingDueByKey: new Map(),
      earliestStart: toCalendarDate('2026-11-01'),
      calendar: DEFAULT_WORKING_CALENDAR,
      assignees: new Map(),
    });
    expect(schedule.get('welcome')).toMatchObject({
      plannedStartDate: '2026-11-02',
      ownerUserId: null,
    });
  });

  it('uses the project snapshot fixture consistently', () => {
    expect(PROJECT.tasks.filter((task) => task.status === 'ready')).toHaveLength(3);
  });
});
