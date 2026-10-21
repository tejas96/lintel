import type {
  NewTask,
  ProjectReferences,
  ScheduleChangeInput,
  TaskChanges,
  TaskDecisionInputs,
  TaskRecord,
  TaskStore,
} from '@lintel/application';
import type { TaskDependencyEdge } from '@lintel/domain';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { DatabaseExecutor } from '../client';
import {
  projectMembers,
  projects,
  taskAttachments,
  taskCollaborators,
  taskDependencies,
  taskScheduleChanges,
  tasks,
  users,
} from '../schema';
import { loadTaskDecisionInputs, referencesInProject } from './task-facts.loader';

function toTask(row: typeof tasks.$inferSelect): TaskRecord {
  const { createdAt: _c, updatedAt: _u, archivedAt: _a, createdByUserId: _b, ...rest } = row;
  const { templateKey: _t, requiresAcknowledgement: _r, position: _p, ...record } = rest;
  return record;
}

/** Drizzle implementation of the task write side. */
export class TaskRepository implements TaskStore {
  constructor(private readonly db: DatabaseExecutor) {}

  async find(taskId: string) {
    const [row] = await this.db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), isNull(tasks.archivedAt)));
    return row ? toTask(row) : null;
  }

  async findForUpdate(taskId: string) {
    const [row] = await this.db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), isNull(tasks.archivedAt)))
      .for('update');
    return row ? toTask(row) : null;
  }

  decisionInputs(taskId: string): Promise<TaskDecisionInputs> {
    return loadTaskDecisionInputs(this.db, taskId);
  }

  async create(task: NewTask) {
    await this.lockProject(task.projectId);
    const [last] = await this.db
      .select({ number: sql<number>`coalesce(max(${tasks.number}), 0)::int` })
      .from(tasks)
      .where(eq(tasks.projectId, task.projectId));
    const [row] = await this.db
      .insert(tasks)
      .values({ ...task, number: (last?.number ?? 0) + 1 })
      .returning();
    if (!row) throw new Error('Creating the task returned no row.');
    return toTask(row);
  }

  async update(taskId: string, expectedVersion: number, changes: TaskChanges) {
    const [row] = await this.db
      .update(tasks)
      .set({ ...changes, version: sql`${tasks.version} + 1`, updatedAt: new Date() })
      .where(and(eq(tasks.id, taskId), eq(tasks.version, expectedVersion)))
      .returning();
    return row ? toTask(row) : null;
  }

  async addActualMinutes(taskId: string, minutes: number) {
    await this.db
      .update(tasks)
      .set({ actualMinutes: sql`${tasks.actualMinutes} + ${minutes}` })
      .where(eq(tasks.id, taskId));
  }

  async collaboratorIds(taskId: string) {
    const rows = await this.db
      .select({ userId: taskCollaborators.userId })
      .from(taskCollaborators)
      .where(eq(taskCollaborators.taskId, taskId));
    return rows.map((row) => row.userId);
  }

  async replaceCollaborators(taskId: string, userIds: readonly string[]) {
    await this.db.delete(taskCollaborators).where(eq(taskCollaborators.taskId, taskId));
    if (userIds.length === 0) return;
    await this.db
      .insert(taskCollaborators)
      .values(userIds.map((userId) => ({ taskId, userId })))
      .onConflictDoNothing();
  }

  async lockProject(projectId: string) {
    await this.db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, projectId))
      .for('update');
  }

  async dependencyGraph(projectId: string) {
    const nodes = await this.db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        ownerUserId: tasks.ownerUserId,
      })
      .from(tasks)
      .where(and(eq(tasks.projectId, projectId), isNull(tasks.archivedAt)));
    if (nodes.length === 0) return { edges: [], nodes };
    const edges = await this.db
      .select({
        taskId: taskDependencies.taskId,
        dependsOnTaskId: taskDependencies.dependsOnTaskId,
      })
      .from(taskDependencies)
      .where(
        inArray(
          taskDependencies.taskId,
          nodes.map((node) => node.id),
        ),
      );
    return { edges, nodes };
  }

  async addDependency(edge: TaskDependencyEdge, createdByUserId: string) {
    const rows = await this.db
      .insert(taskDependencies)
      .values({ ...edge, createdByUserId })
      .onConflictDoNothing()
      .returning({ taskId: taskDependencies.taskId });
    return rows.length > 0;
  }

  async removeDependency(edge: TaskDependencyEdge) {
    const rows = await this.db
      .delete(taskDependencies)
      .where(
        and(
          eq(taskDependencies.taskId, edge.taskId),
          eq(taskDependencies.dependsOnTaskId, edge.dependsOnTaskId),
        ),
      )
      .returning({ taskId: taskDependencies.taskId });
    return rows.length > 0;
  }

  async recordScheduleChange(change: ScheduleChangeInput) {
    await this.db.insert(taskScheduleChanges).values(change);
  }

  async attachFile(taskId: string, fileId: string) {
    await this.db.insert(taskAttachments).values({ taskId, fileId }).onConflictDoNothing();
  }

  referencesInProject(projectId: string, references: ProjectReferences) {
    return referencesInProject(this.db, projectId, references);
  }

  async activeUserIds(userIds: readonly string[]) {
    const unique = [...new Set(userIds)];
    if (unique.length === 0) return new Set<string>();
    const rows = await this.db
      .select({ id: users.id })
      .from(users)
      .where(and(inArray(users.id, unique), eq(users.status, 'active')));
    return new Set(rows.map((row) => row.id));
  }

  async ensureProjectMember(projectId: string, userId: string) {
    const rows = await this.db
      .insert(projectMembers)
      .values({ projectId, userId, projectRole: 'member' })
      .onConflictDoNothing()
      .returning({ userId: projectMembers.userId });
    return rows.length > 0;
  }
}
