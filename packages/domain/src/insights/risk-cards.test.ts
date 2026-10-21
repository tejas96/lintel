import { describe, expect, it } from 'vitest';
import {
  date,
  riskMilestone as milestone,
  riskProject as project,
  RISK_CONTEXT,
  riskTask,
} from './insights.fixtures';
import { buildProjectRiskCards } from './risk-cards.builder';

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
    const dependencies = [{ taskId: 'drawings', dependsOnTaskId: 'design' }];
    const concept = milestone('2026-10-22', [design, drawings], ['drawings'], dependencies);
    expect(concept.health).toBe('at_risk');
    const [card] = buildProjectRiskCards(
      project([design, drawings], [concept], { dependencies }),
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
});
