import { toCalendarDate } from '@lintel/shared';
import { describe, expect, it } from 'vitest';
import { type PrioritizationInput, rankWorkQueue } from './task-priority.strategy';

const today = toCalendarDate('2026-10-21');

function task(overrides: Partial<PrioritizationInput> & { taskId: string }): PrioritizationInput {
  return {
    title: overrides.taskId,
    status: 'ready',
    priority: 'medium',
    dueDate: null,
    estimateMinutes: null,
    projectCriticality: 'normal',
    openDependentCount: 0,
    milestoneDueDate: null,
    milestoneName: null,
    hasUnmetPrerequisites: false,
    isBlocked: false,
    ...overrides,
  };
}

describe('deadline-aware priority strategy', () => {
  it('puts an overdue task above a high-priority task due next week', () => {
    const ranked = rankWorkQueue(
      [
        task({ taskId: 'next-week', priority: 'high', dueDate: toCalendarDate('2026-10-27') }),
        task({ taskId: 'overdue', dueDate: toCalendarDate('2026-10-19') }),
      ],
      today,
    );
    expect(ranked.map((entry) => entry.taskId)).toEqual(['overdue', 'next-week']);
    expect(ranked[0]?.bucket).toBe('overdue');
  });

  it('explains when a task blocks a milestone due tomorrow', () => {
    const [entry] = rankWorkQueue(
      [
        task({
          taskId: 'layout',
          dueDate: toCalendarDate('2026-10-25'),
          openDependentCount: 2,
          milestoneDueDate: toCalendarDate('2026-10-22'),
          milestoneName: 'Concept presentation',
        }),
      ],
      today,
    );
    const codes = entry?.reasons.map((reason) => reason.code);
    expect(codes).toContain('BLOCKS_MILESTONE');
    expect(entry?.reasons.find((r) => r.code === 'BLOCKS_MILESTONE')?.explanation).toContain(
      'due tomorrow',
    );
  });

  it('does not recommend blocked or waiting work', () => {
    const ranked = rankWorkQueue(
      [
        task({ taskId: 'blocked', priority: 'urgent', isBlocked: true, status: 'blocked' }),
        task({ taskId: 'waiting', priority: 'urgent', hasUnmetPrerequisites: true }),
        task({ taskId: 'plain', priority: 'low' }),
      ],
      today,
    );
    expect(ranked.find((entry) => entry.taskId === 'blocked')?.score).toBe(0);
    expect(ranked.find((entry) => entry.taskId === 'waiting')?.bucket).toBe('waiting');
    expect(ranked.find((entry) => entry.taskId === 'blocked')?.headline).toMatch(/Blocked/);
  });

  it('builds a readable headline from the strongest reason', () => {
    const [entry] = rankWorkQueue([task({ taskId: 'today', dueDate: today })], today);
    expect(entry?.headline).toBe('Recommended because it is due today.');
  });
});
