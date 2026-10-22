import { describe, expect, it } from 'vitest';
import { date, RISK_CONTEXT, riskTask, WEEKDAY_CALENDAR } from '../insights/insights.fixtures';
import type { RiskTaskFacts } from '../insights/risk-card.types';
import { buildProjectRiskCards, forecastDelivery } from '../insights/risk-cards.builder';
import type { TaskDependencyEdge } from '../tasks/task-dependency-graph';
import {
  assessProjectSchedule,
  type ProjectScheduleFacts,
  type ScheduledTaskFacts,
} from './project-schedule-health';

/** Wednesday 21 October 2026. */
const today = RISK_CONTEXT.today;

function task(id: string, overrides: Partial<ScheduledTaskFacts> = {}): ScheduledTaskFacts {
  return {
    id,
    title: `Task ${id}`,
    status: 'in_progress',
    plannedStartDate: null,
    dueDate: date('2026-10-28'),
    hasOpenBlocker: false,
    milestoneId: 'm1',
    ...overrides,
  };
}

function facts(
  tasks: readonly ScheduledTaskFacts[],
  milestoneDue: string,
  overrides: Partial<ProjectScheduleFacts> = {},
): ProjectScheduleFacts {
  return {
    status: 'active',
    plannedEndDate: date('2026-12-31'),
    tasks,
    dependencies: [],
    milestones: [
      { id: 'm1', name: 'Concept sign-off', status: 'pending', dueDate: date(milestoneDue) },
    ],
    openBlockerAgesInDays: [],
    ...overrides,
  };
}

const assess = (input: ProjectScheduleFacts) =>
  assessProjectSchedule(input, WEEKDAY_CALENDAR, today);

describe('milestone health on the schedule forecast', () => {
  it('is at risk when a blocked prerequisite pushes it, even weeks away', () => {
    // The blocked task finishes tomorrow at the earliest, so its successor starts a day late.
    const blocked = task('a', { status: 'blocked', dueDate: today, milestoneId: null });
    const next = task('b', {
      status: 'ready',
      plannedStartDate: date('2026-10-22'),
      dueDate: date('2026-11-02'),
    });
    const result = assess(
      facts([blocked, next], '2026-11-02', {
        plannedEndDate: date('2026-11-02'),
        dependencies: [{ taskId: 'b', dependsOnTaskId: 'a' }],
      }),
    );
    expect(result.milestoneRisk.get('m1')).toEqual({
      health: 'at_risk',
      reasons: ['Forecast 1 working day late, on 3 Nov instead of 2 Nov.'],
      openTaskCount: 1,
    });
    expect(result.health).toMatchObject({ status: 'off_track', forecastEndDate: '2026-11-03' });
    // The critical reason comes first: it explains "off track".
    expect(result.health.reasons).toEqual([
      {
        severity: 'critical',
        message:
          'Open work is forecast to finish 1 working day past the planned delivery date, on 2026-11-03.',
      },
      { severity: 'risk', message: '1 milestone is at risk.' },
    ]);
  });

  it('names work planned after the milestone as the cause of its slip', () => {
    const result = assess(facts([task('a', { dueDate: date('2026-11-04') })], '2026-11-02'));
    expect(result.milestoneRisk.get('m1')?.reasons).toEqual([
      'Forecast 2 working days late, on 4 Nov instead of 2 Nov.',
      '1 task is scheduled to finish after the milestone.',
    ]);
  });

  it('flags blocked work close to the milestone before it slips', () => {
    const blocked = task('a', { status: 'blocked', dueDate: date('2026-10-23') });
    expect(assess(facts([blocked], '2026-10-24')).milestoneRisk.get('m1')).toMatchObject({
      health: 'at_risk',
      reasons: ['1 task is blocked.'],
    });
  });

  it('counts an open blocker like the blocked status', () => {
    const waiting = task('a', { dueDate: date('2026-10-23'), hasOpenBlocker: true });
    expect(assess(facts([waiting], '2026-10-26')).milestoneRisk.get('m1')?.reasons).toEqual([
      '1 task is blocked.',
    ]);
  });

  it('stays on track when the forecast keeps the date', () => {
    const result = assess(facts([task('a', { dueDate: date('2026-10-28') })], '2026-10-30'));
    expect(result.milestoneRisk.get('m1')?.health).toBe('on_track');
    expect(result.health).toMatchObject({ status: 'on_track', forecastEndDate: '2026-10-28' });
  });

  it('marks a past-due incomplete milestone as missed', () => {
    expect(assess(facts([], '2026-10-18')).milestoneRisk.get('m1')?.health).toBe('missed');
  });

  it('never forecasts the end in the past', () => {
    const overdue = task('a', { dueDate: date('2026-10-19'), milestoneId: null });
    expect(assess(facts([overdue], '2026-10-30')).health.forecastEndDate).toBe('2026-10-21');
  });
});

describe('milestone health and risk cards', () => {
  const asRiskTask = (fact: ScheduledTaskFacts): RiskTaskFacts =>
    riskTask(fact.id, {
      status: fact.status,
      plannedStartDate: fact.plannedStartDate,
      dueDate: fact.dueDate,
    });

  it('agree: a milestone a card says is late is at risk, and the forecast ends match', () => {
    const tasks = [
      task('a', { status: 'blocked', dueDate: today, milestoneId: 'm0' }),
      task('b', {
        status: 'ready',
        plannedStartDate: date('2026-10-22'),
        dueDate: date('2026-11-02'),
      }),
    ];
    const dependencies: TaskDependencyEdge[] = [{ taskId: 'b', dependsOnTaskId: 'a' }];
    const input = facts(tasks, '2026-11-02', {
      plannedEndDate: date('2026-11-06'),
      dependencies,
      milestones: [
        { id: 'm0', name: 'Survey', status: 'pending', dueDate: today },
        { id: 'm1', name: 'Concept sign-off', status: 'pending', dueDate: date('2026-11-02') },
      ],
    });
    const { health, milestoneRisk } = assess(input);
    const project = {
      id: 'p1',
      criticality: 'normal' as const,
      managerUserId: 'pm',
      tasks: tasks.map(asRiskTask),
      dependencies,
      commitments: input.milestones.map((milestone) => ({
        kind: 'milestone' as const,
        id: milestone.id,
        name: milestone.name,
        dueDate: milestone.dueDate,
        health: milestoneRisk.get(milestone.id)?.health ?? null,
        taskIds: tasks.filter((item) => item.milestoneId === milestone.id).map((item) => item.id),
      })),
    };
    const late = buildProjectRiskCards(project, RISK_CONTEXT).flatMap((card) => [
      { id: card.commitment.id, slip: card.impact.slipWorkingDays },
      ...card.alsoAffects.map((item) => ({ id: item.id, slip: item.slipWorkingDays })),
    ]);
    expect(late).toEqual([
      { id: 'm0', slip: 1 },
      { id: 'm1', slip: 1 },
    ]);
    for (const { id } of late) expect(milestoneRisk.get(id)?.health).toBe('at_risk');
    const delivery = forecastDelivery(
      {
        ...project,
        commitments: [
          {
            kind: 'delivery',
            id: 'p1',
            name: 'Planned delivery',
            dueDate: date('2026-11-06'),
            health: null,
            taskIds: tasks.map((item) => item.id),
          },
        ],
      },
      RISK_CONTEXT,
    );
    expect(health.forecastEndDate).toBe(delivery?.forecastDate);
  });
});
