import { assessMilestoneRisk, type RiskCommitment, type RiskProjectFacts } from '@lintel/domain';
import { type CalendarDate, toCalendarDate } from '@lintel/shared';
import { and, eq, inArray } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { milestones, projects } from '../../schema';
import { loadProjectHealth } from '../shared/project-health.loader';
export interface RiskProjectRow {
  readonly id: string;
  readonly reference: string;
  readonly name: string;
  readonly colorIndex: number;
  readonly managerUserId: string;
}

import { loadTaskRows, loadTaskSignals, toRiskTask } from './risk-task-signals';

/**
 * Everything the risk card rules need for the given live projects, in six
 * queries: projects, tasks, dependencies, open blockers, open new-date
 * requests, approved leave still to come, and pending milestones with their
 * risk (domain milestone rules).
 */
export async function loadRiskFacts(
  db: DatabaseExecutor,
  projectIds: readonly string[],
  today: CalendarDate,
): Promise<{ projects: RiskProjectRow[]; facts: RiskProjectFacts[] }> {
  if (projectIds.length === 0) return { projects: [], facts: [] };
  const ids = [...projectIds];
  const [projectRows, taskRows, milestoneRows] = await Promise.all([
    db
      .select({
        id: projects.id,
        reference: projects.reference,
        name: projects.name,
        colorIndex: projects.colorIndex,
        managerUserId: projects.managerUserId,
        criticality: projects.criticality,
        status: projects.status,
        plannedEndDate: projects.plannedEndDate,
      })
      .from(projects)
      .where(inArray(projects.id, ids)),
    loadTaskRows(db, ids),
    db
      .select()
      .from(milestones)
      .where(and(inArray(milestones.projectId, ids), eq(milestones.status, 'pending'))),
  ]);
  const ownerIds = [
    ...new Set(taskRows.flatMap((row) => (row.ownerUserId ? [row.ownerUserId] : []))),
  ];
  const [signals, health] = await Promise.all([
    loadTaskSignals(
      db,
      taskRows.map((row) => row.id),
      ownerIds,
      today,
    ),
    loadProjectHealth(db, projectRows, today),
  ]);
  const facts = projectRows.map((project): RiskProjectFacts => {
    const own = taskRows.filter((row) => row.projectId === project.id);
    const riskTasks = own.map((row) => toRiskTask(row, signals, today));
    const ownIds = new Set(own.map((row) => row.id));
    const commitments: RiskCommitment[] = milestoneRows
      .filter((milestone) => milestone.projectId === project.id)
      .map((milestone) => {
        const linkedIds = new Set(
          own.filter((row) => row.milestoneId === milestone.id).map((row) => row.id),
        );
        const linked = riskTasks.filter((task) => linkedIds.has(task.id));
        const dueDate = toCalendarDate(milestone.dueDate);
        const milestoneHealth = assessMilestoneRisk(
          { name: milestone.name, status: milestone.status, dueDate, tasks: linked },
          today,
        ).health;
        return {
          kind: 'milestone',
          id: milestone.id,
          name: milestone.name,
          dueDate,
          health: milestoneHealth,
          critical: milestoneHealth === 'missed',
          taskIds: linked.map((task) => task.id),
        };
      });
    const status = health.get(project.id)?.health.status;
    commitments.push({
      kind: 'delivery',
      id: project.id,
      name: 'Planned delivery',
      dueDate: toCalendarDate(project.plannedEndDate),
      health: status === 'at_risk' || status === 'off_track' ? 'at_risk' : null,
      critical: status === 'off_track',
      taskIds: riskTasks.map((task) => task.id),
    });
    return {
      id: project.id,
      criticality: project.criticality,
      managerUserId: project.managerUserId,
      commitments,
      tasks: riskTasks,
      dependencies: signals.edges.filter((edge) => ownIds.has(edge.taskId)),
    };
  });
  return { projects: projectRows, facts };
}
