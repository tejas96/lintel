import { DEFAULT_WORKING_CALENDAR } from '@lintel/domain';
import { describe, expect, it } from 'vitest';
import { applyApprovedSchedule } from './apply-approved-schedule';
import type {
  ProjectScheduleFacts,
  ScopeChangeStore,
  StoredScopeChangeImpact,
  TaskReschedule,
} from './scope-change.store';

/** Records every write the approval makes. Methods the approval never calls throw. */
class RecordingScopeChangeStore implements ScopeChangeStore {
  readonly reschedules: TaskReschedule[] = [];
  readonly corrections: [string, string | null, string | null][] = [];
  readonly milestoneMoves: [string, string][] = [];
  projectEnd: string | null = null;

  constructor(
    private readonly facts: ProjectScheduleFacts,
    private readonly impacts: StoredScopeChangeImpact[],
  ) {}

  async scheduleFacts() {
    return this.facts;
  }
  async impactsOf() {
    return this.impacts;
  }
  async correctImpact(id: string, current: string | null, proposed: string | null) {
    this.corrections.push([id, current, proposed]);
  }
  async rescheduleTask(change: TaskReschedule) {
    this.reschedules.push(change);
  }
  async moveMilestoneDueDate(milestoneId: string, dueDate: string) {
    this.milestoneMoves.push([milestoneId, dueDate]);
  }
  async extendProjectEnd(_projectId: string, plannedEndDate: string) {
    this.projectEnd = plannedEndDate;
  }
  insert(): never {
    throw new Error('not used');
  }
  findById(): never {
    throw new Error('not used');
  }
  decide(): never {
    throw new Error('not used');
  }
  userIdsWithCapability(): never {
    throw new Error('not used');
  }
}

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
      milestoneId: 'm1',
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
      title: 'Done already',
      status: 'done',
      plannedStartDate: '2026-10-20',
      dueDate: '2026-10-21',
      ownerUserId: 'u1',
      milestoneId: 'm1',
    },
  ],
  dependencies: [{ taskId: 'b', dependsOnTaskId: 'a' }],
  milestones: [{ id: 'm1', dueDate: '2026-10-23', status: 'pending' }],
};

function impact(taskId: string, current: string, proposed: string): StoredScopeChangeImpact {
  return {
    id: `i-${taskId}`,
    taskId,
    taskTitle: taskId,
    currentDueDate: current,
    proposedDueDate: proposed,
    shiftWorkingDays: 2,
    isDownstream: taskId !== 'a',
  };
}

async function approve(store: RecordingScopeChangeStore) {
  const events: string[] = [];
  const moves = await applyApprovedSchedule(
    {
      scopeChanges: store,
      settings: { defaultCalendar: async () => ({ id: 'cal', ...DEFAULT_WORKING_CALENDAR }) },
      records: {
        enqueueEvent: async (event) => {
          events.push(event.type);
        },
      },
    },
    {
      scopeChange: {
        id: 'sc1',
        projectId: 'p1',
        title: 'Marble counter',
        description: 'Client chose marble',
        status: 'proposed',
        requestedByUserId: 'u1',
        version: 1,
      },
      note: 'Approved with the client',
      decidedByUserId: 'owner',
    },
  );
  return { moves, events };
}

describe('applying an approved scope change', () => {
  it('moves dates with history, extends the milestone and the planned end', async () => {
    const store = new RecordingScopeChangeStore(facts, [
      impact('a', '2026-10-23', '2026-10-26'),
      impact('b', '2026-10-28', '2026-10-30'),
      impact('c', '2026-10-21', '2026-10-23'),
    ]);
    const { moves, events } = await approve(store);
    expect(moves.map((move) => [move.taskId, move.dueDate])).toEqual([
      ['a', '2026-10-26'],
      ['b', '2026-10-30'],
    ]);
    expect(store.reschedules[0]).toMatchObject({
      taskId: 'a',
      previousDueDate: '2026-10-23',
      plannedStartDate: '2026-10-23',
      scopeChangeId: 'sc1',
      changedByUserId: 'owner',
    });
    expect(store.reschedules[0]?.reason).toContain('Marble counter');
    expect(store.milestoneMoves).toEqual([['m1', '2026-10-26']]);
    expect(store.projectEnd).toBe('2026-10-30');
    expect(events).toEqual(['TaskScheduleChanged', 'TaskScheduleChanged']);
    expect(store.corrections).toEqual([]);
  });

  it('re-bases the shift on dates that changed after the proposal', async () => {
    const moved = {
      ...facts,
      tasks: facts.tasks.map((task) =>
        task.id === 'b' ? { ...task, dueDate: '2026-10-29' } : task,
      ),
    };
    const store = new RecordingScopeChangeStore(moved, [impact('b', '2026-10-28', '2026-10-30')]);
    const { moves } = await approve(store);
    expect(moves[0]?.dueDate).toBe('2026-10-31');
    expect(store.corrections).toEqual([['i-b', '2026-10-29', '2026-10-31']]);
  });
});
