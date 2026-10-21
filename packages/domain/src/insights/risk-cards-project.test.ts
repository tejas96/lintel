import { describe, expect, it } from 'vitest';
import {
  date,
  riskMilestone as milestone,
  riskProject as project,
  RISK_CONTEXT,
  riskTask,
} from './insights.fixtures';
import type { RiskCommitment } from './risk-card.types';
import { buildProjectRiskCards } from './risk-cards.builder';

describe('risk cards for the delivery date, merging and order', () => {
  it('adds a delivery card when the forecast passes the planned end', () => {
    const lateStart = riskTask('t1', {
      status: 'ready',
      plannedStartDate: date('2026-10-19'),
      dueDate: date('2026-10-23'),
    });
    const delivery: RiskCommitment = {
      kind: 'delivery',
      id: 'p1',
      name: 'Delivery',
      dueDate: date('2026-10-23'),
      health: null,
      taskIds: ['t1'],
    };
    const [card] = buildProjectRiskCards(project([lateStart], [delivery]), RISK_CONTEXT);
    expect(card).toMatchObject({
      rule: 'late_start',
      commitment: { kind: 'delivery' },
      impact: { slipWorkingDays: 2, forecastDate: '2026-10-27' },
      nextAction: { label: 'Start "Task t1", report a blocker or ask for a new date' },
    });
  });

  it('explains an off-track project whose milestones are fine, from its most overdue work', () => {
    const inReview = riskTask('review', { status: 'in_review', dueDate: date('2026-10-24') });
    const overdue = riskTask('late', { title: 'Site analysis', dueDate: date('2026-09-26') });
    const delivery: RiskCommitment = {
      kind: 'delivery',
      id: 'p1',
      name: 'Planned delivery',
      dueDate: date('2026-11-03'),
      health: 'at_risk',
      critical: true,
      taskIds: ['review', 'late'],
    };
    const [card] = buildProjectRiskCards(project([inReview, overdue], [delivery]), RISK_CONTEXT);
    expect(card).toMatchObject({
      rule: 'overdue',
      severity: 'critical',
      task: { id: 'late' },
      impact: {
        slipWorkingDays: 0,
        summary:
          'No slip forecast yet; the planned delivery (due 2026-11-03) slips if this is not resolved.',
      },
    });
  });

  it('gives one card per cause and lists the later commitments it also delays', () => {
    const blocked = riskTask('b', {
      status: 'blocked',
      dueDate: date('2026-10-21'),
      openBlocker: {
        category: 'supplier',
        reason: 'Tiles late',
        raisedAt: RISK_CONTEXT.now,
        waitingOnUserId: null,
      },
    });
    const next = riskTask('n', {
      status: 'ready',
      plannedStartDate: date('2026-10-22'),
      dueDate: date('2026-10-23'),
    });
    const first = { ...milestone('2026-10-21', [blocked, next], ['b']), id: 'm1' };
    const second = {
      ...milestone('2026-10-23', [blocked, next], ['n']),
      id: 'm2',
      name: 'Handover',
    };
    const delivery: RiskCommitment = {
      kind: 'delivery',
      id: 'p1',
      name: 'Planned delivery',
      dueDate: date('2026-10-23'),
      health: null,
      taskIds: ['b', 'n'],
    };
    const cards = buildProjectRiskCards(
      project([blocked, next], [first, second, delivery], {
        dependencies: [{ taskId: 'n', dependsOnTaskId: 'b' }],
      }),
      RISK_CONTEXT,
    );
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      rule: 'blocked',
      commitment: { id: 'm1' },
      impact: { slipWorkingDays: 1 },
      alsoAffects: [
        { id: 'm2', name: 'Handover', slipWorkingDays: 1 },
        { kind: 'delivery', id: 'p1', slipWorkingDays: 1 },
      ],
    });
  });

  it('says nothing when every commitment is on track', () => {
    const fine = riskTask('t1', { dueDate: date('2026-10-23') });
    expect(
      buildProjectRiskCards(project([fine], [milestone('2026-10-30', [fine])]), RISK_CONTEXT),
    ).toEqual([]);
  });

  it('orders critical before risk and larger slips first', () => {
    const blocked = riskTask('b', {
      status: 'blocked',
      dueDate: date('2026-10-22'),
      openBlocker: {
        category: 'other',
        reason: 'x',
        raisedAt: RISK_CONTEXT.now,
        waitingOnUserId: 'kabir',
      },
    });
    const overdue = riskTask('o', { dueDate: date('2026-10-16') });
    const cards = buildProjectRiskCards(
      project(
        [blocked, overdue],
        [
          { ...milestone('2026-10-23', [blocked]), id: 'm-risk' },
          { ...milestone('2026-10-20', [overdue]), id: 'm-missed' },
        ],
      ),
      RISK_CONTEXT,
    );
    expect(cards.map((card) => card.commitment.id)).toEqual(['m-missed', 'm-risk']);
    expect(cards[1]?.responsible).toEqual({ role: 'waiting_on', userId: 'kabir' });
  });
});
