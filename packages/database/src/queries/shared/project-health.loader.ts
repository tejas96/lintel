import {
  assessMilestoneRisk,
  defaultProjectHealthCalculator,
  type MilestoneRiskAssessment,
  type ProjectHealth,
  type ProjectStatus,
} from '@lintel/domain';
import { type CalendarDate, daysBetween } from '@lintel/shared';
import { and, inArray, isNull } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { milestones, taskBlockers, tasks } from '../../schema';

export interface ProjectHealthBundle {
  readonly health: ProjectHealth;
  readonly milestoneRisk: Map<string, MilestoneRiskAssessment>;
}

interface ProjectFacts {
  readonly id: string;
  readonly status: ProjectStatus;
  readonly plannedEndDate: string;
}

/**
 * Computes health for several projects with three queries, using the domain
 * calculators. Shared by project lists, the control room and the dashboard.
 */
export async function loadProjectHealth(
  db: DatabaseExecutor,
  projects: readonly ProjectFacts[],
  today: CalendarDate,
): Promise<Map<string, ProjectHealthBundle>> {
  const ids = projects.map((project) => project.id);
  const result = new Map<string, ProjectHealthBundle>();
  if (ids.length === 0) return result;
  const [taskRows, milestoneRows, blockerRows] = await Promise.all([
    db
      .select({
        id: tasks.id,
        projectId: tasks.projectId,
        milestoneId: tasks.milestoneId,
        title: tasks.title,
        status: tasks.status,
        dueDate: tasks.dueDate,
      })
      .from(tasks)
      .where(and(inArray(tasks.projectId, ids), isNull(tasks.archivedAt))),
    db.select().from(milestones).where(inArray(milestones.projectId, ids)),
    db
      .select({ taskId: taskBlockers.taskId, raisedAt: taskBlockers.raisedAt })
      .from(taskBlockers)
      .where(
        and(isNull(taskBlockers.resolvedAt), inArray(taskBlockers.taskId, taskIdsQuery(db, ids))),
      ),
  ]);
  const projectOfTask = new Map(taskRows.map((task) => [task.id, task.projectId]));
  for (const project of projects) {
    const projectTasks = taskRows.filter((task) => task.projectId === project.id);
    const milestoneRisk = new Map<string, MilestoneRiskAssessment>();
    for (const milestone of milestoneRows.filter((row) => row.projectId === project.id)) {
      milestoneRisk.set(
        milestone.id,
        assessMilestoneRisk(
          {
            name: milestone.name,
            status: milestone.status,
            dueDate: milestone.dueDate as CalendarDate,
            tasks: projectTasks
              .filter((task) => task.milestoneId === milestone.id)
              .map((task) => ({
                title: task.title,
                status: task.status,
                dueDate: task.dueDate as CalendarDate | null,
              })),
          },
          today,
        ),
      );
    }
    const blockerAges = blockerRows
      .filter((blocker) => projectOfTask.get(blocker.taskId) === project.id)
      .map((blocker) =>
        Math.max(
          0,
          daysBetween(blocker.raisedAt.toISOString().slice(0, 10) as CalendarDate, today),
        ),
      );
    const health = defaultProjectHealthCalculator.calculate(
      {
        status: project.status,
        plannedEndDate: project.plannedEndDate as CalendarDate,
        tasks: projectTasks.map((task) => ({
          status: task.status,
          dueDate: task.dueDate as CalendarDate | null,
        })),
        milestoneHealth: [...milestoneRisk.values()].map((risk) => risk.health),
        openBlockerAgesInDays: blockerAges,
      },
      today,
    );
    result.set(project.id, { health, milestoneRisk });
  }
  return result;
}

function taskIdsQuery(db: DatabaseExecutor, projectIds: string[]) {
  return db.select({ id: tasks.id }).from(tasks).where(inArray(tasks.projectId, projectIds));
}
