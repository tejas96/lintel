import { describe, expect, it } from 'vitest';
import { date, WEEKDAY_CALENDAR } from './insights.fixtures';
import { type OverdueTaskFact, ownerInterventions } from './owner-intervention.rules';

const context = {
  calendar: WEEKDAY_CALENDAR,
  reminderTime: '10:00',
  now: new Date('2026-10-21T06:00:00.000Z'),
};

const overdue: OverdueTaskFact = {
  taskId: 't1',
  title: 'Kitchen layout',
  projectId: 'p1',
  // Thursday: the manager hears on Friday 09:30, the owner two working days later (Tuesday).
  dueDate: date('2026-10-15'),
  priority: 'urgent',
  projectCriticality: 'normal',
  escalateAfterOverdueDays: 1,
};

describe('owner intervention needed', () => {
  it('lists urgent or critical overdue work once it has reached the owner', () => {
    const [item] = ownerInterventions([overdue], [], context);
    expect(item).toMatchObject({
      kind: 'overdue_escalated',
      taskId: 't1',
      escalatedAt: new Date('2026-10-20T04:00:00.000Z'),
      summary: '"Kitchen layout" was due 2026-10-15; escalated to the owner on 2026-10-20.',
    });
  });

  it('leaves out ordinary overdue work, which stops with the project manager', () => {
    expect(ownerInterventions([{ ...overdue, priority: 'high' }], [], context)).toEqual([]);
    expect(
      ownerInterventions(
        [{ ...overdue, priority: 'low', projectCriticality: 'critical' }],
        [],
        context,
      ),
    ).toHaveLength(1);
  });

  it('waits until the owner alert is due', () => {
    expect(ownerInterventions([{ ...overdue, dueDate: date('2026-10-19') }], [], context)).toEqual(
      [],
    );
  });

  it('lists blockers open for three working days, oldest first', () => {
    const items = ownerInterventions(
      [overdue],
      [
        {
          blockerId: 'b1',
          taskId: 't2',
          title: 'Tile order',
          projectId: 'p1',
          raisedAt: new Date('2026-10-14T04:30:00.000Z'),
          reason: 'Supplier out of stock',
        },
        {
          blockerId: 'b2',
          taskId: 't3',
          title: 'Electrical plan',
          projectId: 'p1',
          raisedAt: new Date('2026-10-20T04:30:00.000Z'),
          reason: 'Waiting for the client',
        },
      ],
      context,
    );
    expect(items.map((item) => item.subjectId)).toEqual(['b1', 't1']);
    expect(items[0]?.summary).toBe(
      '"Tile order" has been blocked since 2026-10-14: Supplier out of stock',
    );
  });
});
