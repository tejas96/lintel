import {
  assessProjectSchedule,
  type MilestoneRiskAssessment,
  type MilestoneStatus,
  type ProjectHealth,
  type ProjectStatus,
  type TaskDependencyEdge,
  type TaskStatus,
  type WorkingCalendar,
} from '@lintel/domain';
import { type CalendarDate, daysBetween, toCalendarDate } from '@lintel/shared';
import { and, inArray, isNull } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { SettingsRepository } from '../../repositories/settings.repository';
import { milestones, taskBlockers, taskDependencies, tasks } from '../../schema';

export interface ProjectHealthBundle {
  readonly health: ProjectHealth;
  readonly milestoneRisk: Map<string, MilestoneRiskAssessment>;
}

interface ProjectFacts {
  readonly id: string;
  readonly status: ProjectStatus;
  readonly plannedEndDate: string;
}

/** The rows the health rules read, as loaded by this loader or by the risk facts loader. */
export interface ProjectScheduleRows {
  readonly tasks: readonly {
    readonly id: string;
    readonly projectId: string;
    readonly milestoneId: string | null;
    readonly title: string;
    readonly status: TaskStatus;
    readonly plannedStartDate: string | null;
    readonly dueDate: string | null;
  }[];
  readonly milestones: readonly {
    readonly id: string;
    readonly projectId: string;
    readonly name: string;
    readonly status: MilestoneStatus;
    readonly dueDate: string;
  }[];
  /** Open (unresolved) blockers. */
  readonly blockers: readonly { readonly taskId: string; readonly raisedAt: Date }[];
  readonly edges: readonly TaskDependencyEdge[];
}

const optionalDate = (value: string | null) => (value ? toCalendarDate(value) : null);

/**
 * Computes health for several projects with five queries in one round
 * (tasks, milestones, open blockers, dependencies and the studio calendar,
 * unless the caller has it), using the domain rules. Shared by project lists,
 * the control room, the dashboard and the daily risk run.
 */
export async function loadProjectHealth(
  db: DatabaseExecutor,
  projects: readonly ProjectFacts[],
  today: CalendarDate,
  calendar?: WorkingCalendar,
): Promise<Map<string, ProjectHealthBundle>> {
  const ids = projects.map((project) => project.id);
  if (ids.length === 0) return new Map();
  const [taskRows, milestoneRows, blockerRows, edges, studioCalendar] = await Promise.all([
    db
      .select({
        id: tasks.id,
        projectId: tasks.projectId,
        milestoneId: tasks.milestoneId,
        title: tasks.title,
        status: tasks.status,
        plannedStartDate: tasks.plannedStartDate,
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
    db
      .select({
        taskId: taskDependencies.taskId,
        dependsOnTaskId: taskDependencies.dependsOnTaskId,
      })
      .from(taskDependencies)
      .where(inArray(taskDependencies.taskId, taskIdsQuery(db, ids))),
    calendar ?? new SettingsRepository(db).defaultCalendar(),
  ]);
  return assessLoadedProjects(
    projects,
    { tasks: taskRows, milestones: milestoneRows, blockers: blockerRows, edges },
    studioCalendar,
    today,
  );
}

/**
 * Health of each project from rows already loaded: the domain rules on one
 * schedule forecast per project (docs/PRODUCT_REQUIREMENTS.md §6, §15.2).
 */
export function assessLoadedProjects(
  projects: readonly ProjectFacts[],
  rows: ProjectScheduleRows,
  calendar: WorkingCalendar,
  today: CalendarDate,
): Map<string, ProjectHealthBundle> {
  const blockedTaskIds = new Set(rows.blockers.map((blocker) => blocker.taskId));
  const result = new Map<string, ProjectHealthBundle>();
  for (const project of projects) {
    const own = rows.tasks.filter((task) => task.projectId === project.id);
    const ownIds = new Set(own.map((task) => task.id));
    const assessed = assessProjectSchedule(
      {
        status: project.status,
        plannedEndDate: toCalendarDate(project.plannedEndDate),
        tasks: own.map((task) => ({
          id: task.id,
          title: task.title,
          status: task.status,
          milestoneId: task.milestoneId,
          plannedStartDate: optionalDate(task.plannedStartDate),
          dueDate: optionalDate(task.dueDate),
          hasOpenBlocker: blockedTaskIds.has(task.id),
        })),
        dependencies: rows.edges.filter((edge) => ownIds.has(edge.taskId)),
        milestones: rows.milestones
          .filter((milestone) => milestone.projectId === project.id)
          .map((milestone) => ({
            id: milestone.id,
            name: milestone.name,
            status: milestone.status,
            dueDate: toCalendarDate(milestone.dueDate),
          })),
        openBlockerAgesInDays: rows.blockers
          .filter((blocker) => ownIds.has(blocker.taskId))
          .map((blocker) =>
            Math.max(
              0,
              daysBetween(toCalendarDate(blocker.raisedAt.toISOString().slice(0, 10)), today),
            ),
          ),
      },
      calendar,
      today,
    );
    result.set(project.id, assessed);
  }
  return result;
}

/** Live (non-archived) tasks of the projects, as the risk facts loader reads them. */
function taskIdsQuery(db: DatabaseExecutor, projectIds: string[]) {
  return db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(inArray(tasks.projectId, projectIds), isNull(tasks.archivedAt)));
}
