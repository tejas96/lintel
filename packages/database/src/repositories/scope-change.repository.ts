import type {
  NewScopeChange,
  ProjectScheduleFacts,
  ScopeChangeDecision,
  ScopeChangeStore,
  TaskReschedule,
} from '@lintel/application';
import type { Capability, ClientSignOff } from '@lintel/domain';
import { and, eq, sql } from 'drizzle-orm';
import type { DatabaseExecutor } from '../client';
import {
  milestones,
  projects,
  roleCapabilities,
  scopeChangeRequests,
  scopeChangeTaskImpacts,
  taskScheduleChanges,
  tasks,
  users,
} from '../schema';
import {
  insertScopeAdditions,
  linkScopeCreatedTask,
  loadScopeCancellations,
  loadScopeNewTasks,
  loadScopeStages,
  settleScopeCancellation,
} from './scope-change-additions.writer';
import { insertScopeSignOff, latestScopeSignOff } from './scope-change-sign-off.writer';
import { loadProjectScheduleFacts } from './scope-schedule-facts.loader';

export class ScopeChangeRepository implements ScopeChangeStore {
  constructor(private readonly db: DatabaseExecutor) {}

  scheduleFacts(projectId: string): Promise<ProjectScheduleFacts | null> {
    return loadProjectScheduleFacts(this.db, projectId);
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
        requiresClientSignOff: change.requiresClientSignOff,
        costImpactMinor: change.costImpactMinor,
        costCategory: change.costCategory,
        feeImpactMinor: change.feeImpactMinor,
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
          currentStartDate: impact.currentStartDate,
          proposedStartDate: impact.proposedStartDate,
          shiftWorkingDays: impact.shiftWorkingDays,
          isDownstream: impact.isDownstream,
          appliesExactDates: impact.appliesExactDates,
        })),
      );
    }
    await insertScopeAdditions(this.db, row.id, change);
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
          requiresClientSignOff: row.requiresClientSignOff,
          costImpactMinor: row.costImpactMinor,
          costCategory: row.costCategory,
          feeImpactMinor: row.feeImpactMinor,
          createdAt: row.createdAt,
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
        currentStartDate: scopeChangeTaskImpacts.currentStartDate,
        proposedStartDate: scopeChangeTaskImpacts.proposedStartDate,
        shiftWorkingDays: scopeChangeTaskImpacts.shiftWorkingDays,
        isDownstream: scopeChangeTaskImpacts.isDownstream,
        appliesExactDates: scopeChangeTaskImpacts.appliesExactDates,
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
      // Scope changes move dates only; the due time stays as it was.
      previousDueTime: null,
      newDueTime: null,
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

  stagesOf(projectId: string) {
    return loadScopeStages(this.db, projectId);
  }

  newTasksOf(scopeChangeId: string) {
    return loadScopeNewTasks(this.db, scopeChangeId);
  }

  cancellationsOf(scopeChangeId: string) {
    return loadScopeCancellations(this.db, scopeChangeId);
  }

  linkCreatedTask(newTaskId: string, taskId: string) {
    return linkScopeCreatedTask(this.db, newTaskId, taskId);
  }

  settleCancellation(
    cancellationId: string,
    outcome: { readonly appliedAt: Date } | { readonly skipReason: string },
  ) {
    return settleScopeCancellation(this.db, cancellationId, outcome);
  }

  latestSignOff(scopeChangeId: string) {
    return latestScopeSignOff(this.db, scopeChangeId);
  }

  recordSignOff(
    signOff: ClientSignOff & { readonly scopeChangeId: string; readonly recordedByUserId: string },
  ) {
    return insertScopeSignOff(this.db, signOff);
  }
}
