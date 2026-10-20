import { DEFAULT_WORKING_CALENDAR, deadlineAwarePriorityStrategy } from '@lintel/domain';
import { type CalendarDate, toCalendarDate } from '@lintel/shared';
import { describe, expect, it } from 'vitest';
import {
  assembleWorkQueue,
  prioritizationInputs,
  remainingMinutes,
  workloadToday,
} from './work-queue.assembler';
import type { WorkQueueSnapshot, WorkQueueTaskRow } from './work-queue.source';

const today = toCalendarDate('2026-10-21'); // a Wednesday

function row(taskId: string, overrides: Partial<WorkQueueTaskRow> = {}): WorkQueueTaskRow {
  return {
    taskId,
    title: taskId,
    status: 'ready',
    priority: 'medium',
    dueDate: toCalendarDate('2026-10-28'),
    plannedStartDate: null,
    estimateMinutes: 240,
    actualMinutes: 0,
    projectCriticality: 'normal',
    milestoneId: null,
    isOwner: true,
    hasOpenBlocker: false,
    needsAcknowledgement: false,
    ...overrides,
  };
}

function snapshot(rows: WorkQueueTaskRow[]): WorkQueueSnapshot<string> {
  const date = (value: string): CalendarDate => toCalendarDate(value);
  return {
    tasks: rows.map((entry) => ({ row: entry, summary: `summary:${entry.taskId}` })),
    edges: [
      { taskId: 'waiting', dependsOnTaskId: 'measure' },
      { taskId: 'drawings', dependsOnTaskId: 'overdue' },
      { taskId: 'site-visit', dependsOnTaskId: 'drawings' },
      { taskId: 'old-done', dependsOnTaskId: 'overdue' },
    ],
    nodes: new Map([
      ['overdue', { status: 'in_progress' as const, milestoneId: null }],
      ['waiting', { status: 'ready' as const, milestoneId: null }],
      ['measure', { status: 'in_progress' as const, milestoneId: null }],
      ['drawings', { status: 'draft' as const, milestoneId: null }],
      ['site-visit', { status: 'draft' as const, milestoneId: 'm-site' }],
      ['old-done', { status: 'done' as const, milestoneId: null }],
    ]),
    milestones: new Map([
      ['m-site', { name: 'Site handover', dueDate: date('2026-10-24'), isOpen: true }],
      ['m-closed', { name: 'Old', dueDate: date('2026-10-22'), isOpen: false }],
    ]),
  };
}

const rows = [
  row('later', { dueDate: toCalendarDate('2026-11-30'), priority: 'low' }),
  row('overdue', {
    status: 'in_progress',
    dueDate: toCalendarDate('2026-10-19'),
    priority: 'urgent',
    milestoneId: 'm-closed',
  }),
  row('waiting', { dueDate: today, needsAcknowledgement: true }),
  row('blocked', { hasOpenBlocker: true, dueDate: today }),
  row('review', { status: 'in_review', dueDate: today }),
  row('collab', { isOwner: false, needsAcknowledgement: true, dueDate: today }),
];

describe('work queue assembly', () => {
  it('builds domain inputs from the graph: open dependents, downstream milestone, prerequisites', () => {
    const inputs = prioritizationInputs(snapshot(rows));
    const overdue = inputs.find((input) => input.taskId === 'overdue');
    // "old-done" is finished, so only "drawings" still waits on it.
    expect(overdue?.openDependentCount).toBe(1);
    // Its own milestone is closed; it unblocks "Site handover" through drawings → site visit.
    expect(overdue?.milestoneName).toBe('Site handover');
    expect(inputs.find((input) => input.taskId === 'waiting')?.hasUnmetPrerequisites).toBe(true);
    expect(inputs.find((input) => input.taskId === 'blocked')?.isBlocked).toBe(true);
  });

  it('keeps the domain ranking, picks the next actionable task and counts every bucket', () => {
    const queue = assembleWorkQueue(snapshot(rows), today, deadlineAwarePriorityStrategy);
    // Score first; zero-score items (blocked, waiting, in review, no pressure) by due date.
    expect(queue.items.map((item) => item.task)).toEqual([
      'summary:overdue',
      'summary:collab',
      'summary:blocked',
      'summary:review',
      'summary:waiting',
      'summary:later',
    ]);
    expect(queue.next?.task).toBe('summary:overdue');
    expect(queue.next?.reasons.map((reason) => reason.code)).toEqual([
      'EXPLICIT_PRIORITY',
      'OVERDUE',
      'BLOCKS_MILESTONE',
      'UNBLOCKS_OTHERS',
      'IN_PROGRESS',
    ]);
    expect(queue.counts).toEqual({
      overdue: 1,
      today: 1,
      upcoming: 0,
      blocked: 1,
      waiting: 1,
      inReview: 1,
      needsAcknowledgement: 1,
    });
  });

  it('has no next task when nothing is actionable', () => {
    const queue = assembleWorkQueue(
      snapshot([row('blocked', { hasOpenBlocker: true })]),
      today,
      deadlineAwarePriorityStrategy,
    );
    expect(queue.next).toBeNull();
  });
});

describe('workload today', () => {
  const person = {
    userId: 'u1',
    fullName: 'Ananya',
    capacityPercent: 100,
    calendar: DEFAULT_WORKING_CALENDAR,
  };

  it('uses remaining estimates (default when missing) for owned, confirmed work only', () => {
    expect(remainingMinutes(row('a', { estimateMinutes: 240, actualMinutes: 300 }))).toBe(0);
    expect(remainingMinutes(row('b', { estimateMinutes: null, actualMinutes: 20 }))).toBe(100);
    const workload = workloadToday(
      person,
      [
        row('due-today', { dueDate: today, estimateMinutes: 300, actualMinutes: 60 }),
        row('no-estimate', { dueDate: today, estimateMinutes: null }),
        row('draft', { status: 'draft', dueDate: today }),
        row('collab', { isOwner: false, dueDate: today }),
        row('review', { status: 'in_review', dueDate: today }),
      ],
      null,
      today,
    );
    expect(workload).toEqual({
      availableMinutesToday: 480,
      committedMinutesToday: 360,
      status: 'balanced',
      onLeaveToday: false,
    });
  });

  it('halves availability on a half day of approved leave', () => {
    const workload = workloadToday(person, [row('due-today', { dueDate: today })], 1, today);
    expect(workload).toMatchObject({
      availableMinutesToday: 240,
      committedMinutesToday: 240,
      onLeaveToday: true,
    });
  });
});
