import type {
  BlockerFacts,
  DeliverableReviewFacts,
  FollowUpStore,
  TaskDeadlineFacts,
  TaskReviewFacts,
} from '@lintel/application';
import type { Capability } from '@lintel/domain';
import type { CalendarDate } from '@lintel/shared';
import { and, asc, eq } from 'drizzle-orm';
import type { DatabaseExecutor } from '../client';
import {
  deliverables,
  deliverableVersions,
  projects,
  roleCapabilities,
  taskBlockers,
  tasks,
  users,
} from '../schema';

const projectColumns = {
  id: projects.id,
  name: projects.name,
  reference: projects.reference,
  status: projects.status,
  criticality: projects.criticality,
  managerUserId: projects.managerUserId,
};

/** Facts the reminder workflows re-check right before they notify anyone. */
export class FollowUpRepository implements FollowUpStore {
  constructor(private readonly db: DatabaseExecutor) {}

  async taskDeadline(taskId: string): Promise<TaskDeadlineFacts | null> {
    const [row] = await this.db
      .select({ task: tasks, project: projectColumns, ownerName: users.fullName })
      .from(tasks)
      .innerJoin(projects, eq(projects.id, tasks.projectId))
      .leftJoin(users, eq(users.id, tasks.ownerUserId))
      .where(eq(tasks.id, taskId));
    if (!row) return null;
    const { task } = row;
    return {
      taskId: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate as CalendarDate | null,
      escalateAfterOverdueDays: task.escalateAfterOverdueDays,
      ownerUserId: task.ownerUserId,
      ownerName: row.ownerName,
      archived: task.archivedAt !== null,
      project: row.project,
    };
  }

  async taskReview(taskId: string): Promise<TaskReviewFacts | null> {
    const [row] = await this.db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        submittedAt: tasks.submittedAt,
        reviewerUserId: tasks.reviewerUserId,
        ownerName: users.fullName,
        project: projectColumns,
      })
      .from(tasks)
      .innerJoin(projects, eq(projects.id, tasks.projectId))
      .leftJoin(users, eq(users.id, tasks.ownerUserId))
      .where(eq(tasks.id, taskId));
    if (!row) return null;
    const { id, ...facts } = row;
    return { taskId: id, ...facts };
  }

  async deliverableReview(versionId: string): Promise<DeliverableReviewFacts | null> {
    const [row] = await this.db
      .select({
        versionId: deliverableVersions.id,
        deliverableId: deliverables.id,
        deliverableName: deliverables.name,
        versionNumber: deliverableVersions.versionNumber,
        decision: deliverableVersions.decision,
        deliverableStatus: deliverables.status,
        reviewerUserId: deliverables.reviewerUserId,
        submittedAt: deliverableVersions.submittedAt,
        submittedByName: users.fullName,
        project: projectColumns,
      })
      .from(deliverableVersions)
      .innerJoin(deliverables, eq(deliverables.id, deliverableVersions.deliverableId))
      .innerJoin(projects, eq(projects.id, deliverables.projectId))
      .leftJoin(users, eq(users.id, deliverableVersions.submittedByUserId))
      .where(eq(deliverableVersions.id, versionId));
    return row ?? null;
  }

  async blocker(blockerId: string): Promise<BlockerFacts | null> {
    const [row] = await this.db
      .select({
        blockerId: taskBlockers.id,
        taskId: tasks.id,
        taskTitle: tasks.title,
        category: taskBlockers.category,
        reason: taskBlockers.reason,
        raisedAt: taskBlockers.raisedAt,
        resolvedAt: taskBlockers.resolvedAt,
        project: projectColumns,
      })
      .from(taskBlockers)
      .innerJoin(tasks, eq(tasks.id, taskBlockers.taskId))
      .innerJoin(projects, eq(projects.id, tasks.projectId))
      .where(eq(taskBlockers.id, blockerId));
    return row ?? null;
  }

  async activeUserIdsWithCapability(capability: Capability): Promise<string[]> {
    const rows = await this.db
      .select({ id: users.id })
      .from(users)
      .innerJoin(roleCapabilities, eq(roleCapabilities.role, users.role))
      .where(and(eq(roleCapabilities.capability, capability), eq(users.status, 'active')))
      .orderBy(asc(users.createdAt));
    return rows.map((row) => row.id);
  }
}
