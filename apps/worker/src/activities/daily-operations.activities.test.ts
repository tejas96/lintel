import type { MilestoneRiskFact, ProjectRiskFacts } from '@lintel/application';
import { MILESTONE_HEALTH_ACTIVITY } from '@lintel/application';
import type { MilestoneHealth, ProjectHealthStatus } from '@lintel/domain';
import { describe, expect, it } from 'vitest';
import { createFakeWorld } from '../testing/fake-world';
import { MANAGER } from '../testing/fixtures';
import { createDailyOperationsActivities } from './daily-operations.activities';

function milestone(id: string, health: MilestoneHealth): MilestoneRiskFact {
  return {
    id,
    name: `Milestone ${id}`,
    dueDate: '2026-11-12',
    assessment: { health, reasons: [`${id} is ${health}`], openTaskCount: 1 },
  };
}

function project(status: ProjectHealthStatus, milestones: MilestoneRiskFact[]): ProjectRiskFacts {
  return {
    projectId: 'project-1',
    name: 'Saska residence',
    reference: 'TST-001',
    managerUserId: MANAGER,
    health: {
      status,
      reasons:
        status === 'off_track' ? [{ severity: 'critical', message: '3 task(s) are overdue.' }] : [],
      openTaskCount: 4,
      overdueTaskCount: 3,
      blockedTaskCount: 0,
      completedTaskCount: 0,
      forecastEndDate: null,
    },
    milestones,
  };
}

function world() {
  const fake = createFakeWorld('2026-11-09T03:00:00.000Z');
  fake.stores.notifications.activeUsers.add(MANAGER);
  return { ...fake, activities: createDailyOperationsActivities(fake.deps) };
}

describe('daily project risk review', () => {
  it('reports milestones newly at risk once and records their health', async () => {
    const fake = world();
    const operations = fake.stores.background.operations;
    operations.projects = [
      project('at_risk', [milestone('m1', 'at_risk'), milestone('m2', 'on_track')]),
    ];
    expect(await fake.activities.notifyProjectRisks()).toEqual({
      projectsChecked: 1,
      projectsNotified: 1,
      milestoneChanges: 1,
    });
    const [notification] = fake.stores.notifications.created;
    expect(notification).toMatchObject({
      recipientUserId: MANAGER,
      kind: 'project_at_risk',
      dedupeKey: `project_at_risk:${MANAGER}:project-1:2026-11-09`,
    });
    expect(notification?.body).toContain('Milestone m1');
    expect(fake.stores.records.activities[0]).toMatchObject({
      type: MILESTONE_HEALTH_ACTIVITY,
      payload: { milestoneId: 'm1', health: 'at_risk' },
    });
  });

  it('does not repeat a known risk, but keeps telling the manager while off track', async () => {
    const fake = world();
    const operations = fake.stores.background.operations;
    operations.recorded.set('m1', 'at_risk');
    operations.projects = [project('at_risk', [milestone('m1', 'at_risk')])];
    expect((await fake.activities.notifyProjectRisks()).projectsNotified).toBe(0);
    operations.projects = [project('off_track', [milestone('m1', 'at_risk')])];
    expect((await fake.activities.notifyProjectRisks()).projectsNotified).toBe(1);
    expect(fake.stores.notifications.created[0]?.title).toContain('off track');
  });

  it('sends at most one notification per project per day', async () => {
    const fake = world();
    const operations = fake.stores.background.operations;
    operations.existingNotifications.add(
      `${MANAGER}|project_at_risk:${MANAGER}:project-1:2026-11-09`,
    );
    operations.projects = [project('off_track', [milestone('m1', 'missed')])];
    expect((await fake.activities.notifyProjectRisks()).projectsNotified).toBe(0);
    expect(fake.stores.records.activities).toEqual([]);
  });
});

describe('deadline workflow self-healing', () => {
  it('starts deadline workflows for open tasks that never had one', async () => {
    const fake = world();
    fake.stores.background.workflowRuns.tasksWithoutRuns = ['t1', 't2'];
    expect(await fake.activities.healDeadlineWorkflows()).toEqual({ started: 2 });
    expect(fake.scheduler.calls).toEqual([
      {
        kind: 'start',
        request: {
          workflowType: 'taskDeadlineWorkflow',
          workflowId: 'task-deadline:t1',
          args: ['t1'],
        },
      },
      {
        kind: 'start',
        request: {
          workflowType: 'taskDeadlineWorkflow',
          workflowId: 'task-deadline:t2',
          args: ['t2'],
        },
      },
    ]);
    expect(fake.stores.background.workflowRuns.runs.map((run) => run.workflowId)).toEqual([
      'task-deadline:t1',
      'task-deadline:t2',
    ]);
  });
});

describe('daily business health reading', () => {
  it('records today’s score in the business timezone', async () => {
    const fake = createFakeWorld('2026-11-08T20:00:00.000Z');
    const activities = createDailyOperationsActivities(fake.deps);
    // 01:30 on Monday 9 November in India.
    expect(await activities.recordBusinessHealth()).toEqual({ recorded: 1 });
    expect(fake.stores.background.insights.days).toEqual(['2026-11-09']);
  });
});
