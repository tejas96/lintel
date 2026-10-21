import type { ProjectScheduleFacts } from '@lintel/application';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { DatabaseExecutor } from '../client';
import { milestones, projects, taskDependencies, tasks } from '../schema';

/** Everything needed to work out how a schedule change ripples through a project. */
export async function loadProjectScheduleFacts(
  db: DatabaseExecutor,
  projectId: string,
): Promise<ProjectScheduleFacts | null> {
  const [project] = await db
    .select({ id: projects.id, name: projects.name, plannedEndDate: projects.plannedEndDate })
    .from(projects)
    .where(eq(projects.id, projectId));
  if (!project) return null;
  const projectTaskIds = db
    .select({ id: tasks.id })
    .from(tasks)
    .where(eq(tasks.projectId, projectId));
  // Sequential on purpose: inside a transaction every query shares one connection.
  const taskRows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      plannedStartDate: tasks.plannedStartDate,
      dueDate: tasks.dueDate,
      ownerUserId: tasks.ownerUserId,
      milestoneId: tasks.milestoneId,
    })
    .from(tasks)
    .where(and(eq(tasks.projectId, projectId), isNull(tasks.archivedAt)))
    .orderBy(tasks.number);
  const dependencies = await db
    .select({
      taskId: taskDependencies.taskId,
      dependsOnTaskId: taskDependencies.dependsOnTaskId,
    })
    .from(taskDependencies)
    .where(inArray(taskDependencies.taskId, projectTaskIds));
  const milestoneRows = await db
    .select({
      id: milestones.id,
      name: milestones.name,
      dueDate: milestones.dueDate,
      status: milestones.status,
    })
    .from(milestones)
    .where(eq(milestones.projectId, projectId));
  return {
    projectId: project.id,
    name: project.name,
    plannedEndDate: project.plannedEndDate,
    tasks: taskRows,
    dependencies,
    milestones: milestoneRows,
  };
}
