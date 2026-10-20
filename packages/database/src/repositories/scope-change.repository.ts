import type {
  NewScopeChange,
  ProjectScheduleFacts,
  ScopeChangeDecision,
  ScopeChangeStore,
  TaskReschedule,
} from '@lintel/application';
import type { Capability } from '@lintel/domain';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { DatabaseExecutor } from '../client';
import {
  milestones,
  projects,
  roleCapabilities,
  scopeChangeRequests,
  scopeChangeTaskImpacts,
  taskDependencies,
  taskScheduleChanges,
  tasks,
  users,
} from '../schema';

export class ScopeChangeRepository implements ScopeChangeStore {
  constructor(private readonly db: DatabaseExecutor) {}

  async scheduleFacts(projectId: string): Promise<ProjectScheduleFacts | null> {
    const [project] = await this.db
      .select({ id: projects.id, name: projects.name, plannedEndDate: projects.plannedEndDate })
      .from(projects)
      .where(eq(projects.id, projectId));
    if (!project) return null;
    const projectTaskIds = this.db
      .select({ id: tasks.id })
      .from(tasks)
      .where(eq(tasks.projectId, projectId));
    // Sequential on purpose: inside a transaction every query shares one connection.
    const taskRows = await this.db
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
    const dependencies = await this.db
      .select({
        taskId: taskDependencies.taskId,
        dependsOnTaskId: taskDependencies.dependsOnTaskId,
      })
      .from(taskDependencies)
      .where(inArray(taskDependencies.taskId, projectTaskIds));
    const milestoneRows = await this.db
      .select({ id: milestones.id, dueDate: milestones.dueDate, status: milestones.status })
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

  async insert(change: NewScopeChange) {
    const [row] = await this.db
      .insert(scopeChangeRequests)
      .values({
        projectId: change.projectId,
        title: change.title,
        description: change.description,
        requestedByUserId: change.requestedByUserId,
        projectEndImpactDays: change.projectEndImpactDays,
      })
      .returning({ id: scopeChangeRequests.id });
    if (!row) throw new Error('Saving the scope change returned no row.');
    if (change.impacts.length > 0) {
      await this.db.insert(scopeChangeTaskImpacts).values(
        change.impacts.map((impact) => ({
          scopeChangeId: row.id,
          taskId: impact.taskId,
          currentDueDate: impact.currentDueDate,
          proposedDueDate: impact.proposedDueDate,
          shiftWorkingDays: impact.shiftWorkingDays,
          isDownstream: impact.isDownstream,
        })),
      );
    }
    return row;
  }

  async findById(scopeChangeId: string) {
    const [row] = await this.db
      .select()
      .from(scopeChangeRequests)
      .where(eq(scopeChangeRequests.id, scopeChangeId));
    return row
      ? {
          id: row.id,
          projectId: row.projectId,
          title: row.title,
          description: row.description,
          status: row.status,
          requestedByUserId: row.requestedByUserId,
          version: row.version,
        }
      : null;
  }

  async impactsOf(scopeChangeId: string) {
    return this.db
      .select({
        id: scopeChangeTaskImpacts.id,
        taskId: scopeChangeTaskImpacts.taskId,
        taskTitle: tasks.title,
        currentDueDate: scopeChangeTaskImpacts.currentDueDate,
        proposedDueDate: scopeChangeTaskImpacts.proposedDueDate,
        shiftWorkingDays: scopeChangeTaskImpacts.shiftWorkingDays,
        isDownstream: scopeChangeTaskImpacts.isDownstream,
      })
      .from(scopeChangeTaskImpacts)
      .innerJoin(tasks, eq(tasks.id, scopeChangeTaskImpacts.taskId))
      .where(eq(scopeChangeTaskImpacts.scopeChangeId, scopeChangeId))
      .orderBy(tasks.number);
  }

  async decide(scopeChangeId: string, expectedVersion: number, decision: ScopeChangeDecision) {
    const rows = await this.db
      .update(scopeChangeRequests)
      .set({
        status: decision.status,
        decidedByUserId: decision.decidedByUserId,
        decidedAt: decision.decidedAt,
        decisionNote: decision.note,
        version: sql`${scopeChangeRequests.version} + 1`,
        updatedAt: decision.decidedAt,
      })
      .where(
        and(
          eq(scopeChangeRequests.id, scopeChangeId),
          eq(scopeChangeRequests.version, expectedVersion),
          eq(scopeChangeRequests.status, 'proposed'),
        ),
      )
      .returning({ id: scopeChangeRequests.id });
    return rows.length > 0;
  }

  async correctImpact(
    impactId: string,
    currentDueDate: string | null,
    proposedDueDate: string | null,
  ) {
    await this.db
      .update(scopeChangeTaskImpacts)
      .set({ currentDueDate, proposedDueDate })
      .where(eq(scopeChangeTaskImpacts.id, impactId));
  }

  async rescheduleTask(change: TaskReschedule) {
    await this.db
      .update(tasks)
      .set({
        plannedStartDate: change.plannedStartDate,
        dueDate: change.dueDate,
        version: sql`${tasks.version} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, change.taskId));
    await this.db.insert(taskScheduleChanges).values({
      taskId: change.taskId,
      previousDueDate: change.previousDueDate,
      newDueDate: change.dueDate,
      reason: change.reason,
      isApproved: true,
      scopeChangeId: change.scopeChangeId,
      changedByUserId: change.changedByUserId,
    });
  }

  async moveMilestoneDueDate(milestoneId: string, dueDate: string) {
    await this.db
      .update(milestones)
      .set({ dueDate, version: sql`${milestones.version} + 1`, updatedAt: new Date() })
      .where(eq(milestones.id, milestoneId));
  }

  async extendProjectEnd(projectId: string, plannedEndDate: string) {
    await this.db
      .update(projects)
      .set({ plannedEndDate, version: sql`${projects.version} + 1`, updatedAt: new Date() })
      .where(eq(projects.id, projectId));
  }

  async userIdsWithCapability(capability: Capability) {
    const rows = await this.db
      .select({ id: users.id })
      .from(users)
      .innerJoin(roleCapabilities, eq(roleCapabilities.role, users.role))
      .where(and(eq(roleCapabilities.capability, capability), eq(users.status, 'active')));
    return rows.map((row) => row.id);
  }
}
