import { describe, expect, it } from 'vitest';
import { assessMilestoneRisk } from '../projects/milestone-risk';
import { date, RISK_CONTEXT, riskTask } from './insights.fixtures';
import type { RiskCommitment, RiskProjectFacts, RiskTaskFacts } from './risk-card.types';
import { buildProjectRiskCards } from './risk-cards.builder';

function milestone(
  dueDate: string,
  tasks: readonly RiskTaskFacts[],
  linked: readonly string[] = tasks.map((task) => task.id),
): RiskCommitment {
  const assessment = assessMilestoneRisk(
    {
      name: 'Concept approved',
      status: 'pending',
      dueDate: date(dueDate),
      tasks: tasks
        .filter((task) => linked.includes(task.id))
        .map((task) => ({ title: task.title, status: task.status, dueDate: task.dueDate })),
    },
    RISK_CONTEXT.today,
  );
  return {
    kind: 'milestone',
    id: 'm1',
    name: 'Concept approved',
    dueDate: date(dueDate),
    health: assessment.health,
    taskIds: linked,
  };
}

function project(
  tasks: readonly RiskTaskFacts[],
  commitments: readonly RiskCommitment[],
  overrides: Partial<RiskProjectFacts> = {},
): RiskProjectFacts {
  return {
    id: 'p1',
    criticality: 'normal',
    managerUserId: 'pm',
    commitments,
    tasks,
    dependencies: [],
    ...overrides,
  };
}

describe('risk cards', () => {
  it('explains a blocked task: what, impact, action, who and when it escalates', () => {
    const blocked = riskTask('t1', {
      title: 'Site measurements',
      status: 'blocked',
      dueDate: date('2026-10-22'),
      openBlocker: {
        category: 'client',
        reason: 'Floor plan not shared yet',
        // Tuesday 10:30 in India.
        raisedAt: new Date('2026-10-20T05:00:00.000Z'),
        waitingOnUserId: null,
      },
    });
    const [card] = buildProjectRiskCards(
      project([blocked], [milestone('2026-10-23', [blocked])]),
      RISK_CONTEXT,
    );
    expect(card).toMatchObject({
      rule: 'blocked',
      severity: 'risk',
      happening:
        '"Site measurements" is waiting on the client since 2026-10-20: Floor plan not shared yet',
      impact: { slipWorkingDays: 0 },
      nextAction: {
        label: 'Chase the client so "Site measurements" can move',
        target: { kind: 'task', id: 't1' },
      },
      responsible: { role: 'task_owner', userId: 'meera' },
      escalation: {
        audience: 'business_owner',
        alreadyHappened: false,
        summary: 'The studio owner is alerted on 2026-10-23 at 10:30 if it is still blocked.',
      },
    });
  });

  it('follows a slip upstream to the task where the delay starts', () => {
    const design = riskTask('design', { title: 'Design brief', dueDate: date('2026-10-19') });
    const drawings = riskTask('drawings', {
      title: 'Drawings',
      status: 'ready',
      plannedStartDate: date('2026-10-21'),
      dueDate: date('2026-10-22'),
    });
    const [card] = buildProjectRiskCards(
      project([design, drawings], [milestone('2026-10-22', [design, drawings], ['drawings'])], {
        dependencies: [{ taskId: 'drawings', dependsOnTaskId: 'design' }],
      }),
      RISK_CONTEXT,
    );
    expect(card).toMatchObject({
      rule: 'overdue',
      severity: 'critical',
      task: { id: 'design', title: 'Design brief' },
      impact: {
        slipWorkingDays: 1,
        forecastDate: '2026-10-23',
        summary:
          '"Concept approved" is forecast 1 working day late, on 2026-10-23 instead of 2026-10-22.',
      },
      responsible: { role: 'task_owner', userId: 'meera' },
      escalation: {
        audience: 'project_manager',
        alreadyHappened: true,
        summary: 'The project manager was alerted on 2026-10-20 at 09:30; it is still open.',
      },
    });
  });

  it('puts a waiting new-date request first: the manager decides, nothing escalates', () => {
    const late = riskTask('t1', {
      status: 'blocked',
      dueDate: date('2026-10-20'),
      openDateRequest: { id: 'r1', proposedDueDate: date('2026-10-27') },
    });
    const [card] = buildProjectRiskCards(
      project([late], [milestone('2026-10-22', [late])]),
      RISK_CONTEXT,
    );
    expect(card).toMatchObject({
      rule: 'date_request_waiting',
      responsible: { role: 'project_manager', userId: 'pm' },
      nextAction: { target: { kind: 'date_request', id: 'r1', taskId: 't1' } },
      escalation: null,
    });
  });

  it('asks for cover when the owner is away and links to the absence', () => {
    const away = riskTask('t1', {
      dueDate: date('2026-10-23'),
      status: 'ready',
      plannedStartDate: date('2026-10-23'),
      ownerAway: {
        leaveRequestId: 'leave1',
        startDate: date('2026-10-21'),
        endDate: date('2026-10-23'),
      },
    });
    const commitment = { ...milestone('2026-10-23', [away]), health: 'at_risk' as const };
    const [card] = buildProjectRiskCards(project([away], [commitment]), RISK_CONTEXT);
    expect(card).toMatchObject({
      rule: 'owner_away',
      responsible: { role: 'project_manager' },
      nextAction: { label: 'Choose who covers "Task t1"', target: { kind: 'leave', id: 'leave1' } },
    });
  });

  it('flags a missed milestone whose work is done but not marked complete', () => {
    const done = riskTask('t1', { status: 'done', dueDate: date('2026-10-16') });
    const [card] = buildProjectRiskCards(
      project([done], [milestone('2026-10-19', [done])]),
      RISK_CONTEXT,
    );
    expect(card).toMatchObject({
      rule: 'missed_without_open_work',
      severity: 'critical',
      task: null,
      responsible: { role: 'project_manager', userId: 'pm' },
      nextAction: { target: { kind: 'project', id: 'p1' } },
    });
  });

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
