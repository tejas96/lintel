import { DEFAULT_WORKING_CALENDAR } from '@lintel/domain';
import { ValidationFailedError } from '@lintel/shared';
import { describe, expect, it } from 'vitest';
import type { ProjectScheduleFacts } from '../scope-changes/scope-change.store';
import { previewReschedule } from './reschedule-plan';

const facts: ProjectScheduleFacts = {
  projectId: 'p1',
  name: 'Juniper Studio Flat',
  plannedEndDate: '2026-11-11',
  tasks: [
    {
      id: 'measure',
      title: 'Measure',
      status: 'in_progress',
      plannedStartDate: '2026-11-02',
      dueDate: '2026-11-03',
      ownerUserId: 'u1',
      milestoneId: 'm1',
    },
    {
      id: 'layout',
      title: 'Layout',
      status: 'draft',
      plannedStartDate: '2026-11-04',
      dueDate: '2026-11-05',
      ownerUserId: 'u2',
      milestoneId: null,
    },
  ],
  dependencies: [{ taskId: 'layout', dependsOnTaskId: 'measure' }],
  milestones: [{ id: 'm1', name: 'Survey done', dueDate: '2026-11-03', status: 'pending' }],
};

describe('previewing a timeline reschedule', () => {
  it('marks committed moves, the knock-on and a slipping milestone', () => {
    const preview = previewReschedule(
      facts,
      [{ taskId: 'measure', plannedStartDate: '2026-11-02', dueDate: '2026-11-04' }],
      DEFAULT_WORKING_CALENDAR,
    );
    expect(preview.moves.map((move) => [move.taskId, move.committed, move.isDownstream])).toEqual([
      ['measure', true, false],
      ['layout', false, true],
    ]);
    expect(preview.needsReason).toBe(true);
    expect(preview.requiresScopeChange).toBe(false);
    expect(preview.slippingMilestones).toEqual([
      { id: 'm1', name: 'Survey done', dueDate: '2026-11-03', latestTaskDueDate: '2026-11-04' },
    ]);
  });

  it('asks for a scope change when the agreed end would move', () => {
    const preview = previewReschedule(
      facts,
      [{ taskId: 'layout', plannedStartDate: '2026-11-10', dueDate: '2026-11-13' }],
      DEFAULT_WORKING_CALENDAR,
    );
    expect(preview.requiresScopeChange).toBe(true);
    expect(preview.projectEndImpactDays).toBe(2);
    // Only a draft moved: no committed deadline, so no reason is needed.
    expect(preview.needsReason).toBe(false);
  });

  it('refuses an empty request and dates in the wrong order', () => {
    expect(() => previewReschedule(facts, [], DEFAULT_WORKING_CALENDAR)).toThrow(
      ValidationFailedError,
    );
    expect(() =>
      previewReschedule(
        facts,
        [{ taskId: 'layout', plannedStartDate: '2026-11-06', dueDate: '2026-11-05' }],
        DEFAULT_WORKING_CALENDAR,
      ),
    ).toThrow('Some dates cannot be used.');
  });

  it('moves a date dropped on a day off to the next working day', () => {
    const preview = previewReschedule(
      facts,
      // Sunday 8 Nov is not a working day: Layout starts and ends on Monday 9 Nov.
      [{ taskId: 'layout', plannedStartDate: '2026-11-08', dueDate: '2026-11-08' }],
      DEFAULT_WORKING_CALENDAR,
    );
    expect(preview.moves[0]).toMatchObject({
      proposedStartDate: '2026-11-09',
      proposedDueDate: '2026-11-09',
    });
  });

  it("keeps a moved bar's length in working days when it lands on a day off", () => {
    const preview = previewReschedule(
      facts,
      // Measure (Mon 2 – Tue 3, 2 working days) moved whole onto Sun 8 – Mon 9 Nov.
      [{ taskId: 'measure', plannedStartDate: '2026-11-08', dueDate: '2026-11-09' }],
      DEFAULT_WORKING_CALENDAR,
    );
    expect(preview.moves[0]).toMatchObject({
      proposedStartDate: '2026-11-09',
      proposedDueDate: '2026-11-10',
    });
  });
});
