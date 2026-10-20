import type { ProjectAccessFacts, ProjectAccessStore } from '@lintel/application';
import { and, eq } from 'drizzle-orm';
import type { DatabaseExecutor } from '../client';
import { deliverables, milestones, projectMembers, projects, tasks } from '../schema';

export class ProjectAccessRepository implements ProjectAccessStore {
  constructor(private readonly db: DatabaseExecutor) {}

  async accessFacts(projectId: string, userId: string): Promise<ProjectAccessFacts> {
    const [row] = await this.db
      .select({
        id: projects.id,
        managerUserId: projects.managerUserId,
        ownerUserId: projects.ownerUserId,
        projectRole: projectMembers.projectRole,
      })
      .from(projects)
      .leftJoin(
        projectMembers,
        and(eq(projectMembers.projectId, projects.id), eq(projectMembers.userId, userId)),
      )
      .where(eq(projects.id, projectId))
      .limit(1);
    if (!row)
      return {
        projectId,
        exists: false,
        projectRole: null,
        managerUserId: null,
        ownerUserId: null,
      };
    return {
      projectId,
      exists: true,
      projectRole: row.projectRole,
      managerUserId: row.managerUserId,
      ownerUserId: row.ownerUserId,
    };
  }

  async memberProjectIds(userId: string): Promise<string[]> {
    const rows = await this.db
      .select({ projectId: projectMembers.projectId })
      .from(projectMembers)
      .where(eq(projectMembers.userId, userId));
    const managed = await this.db
      .select({ projectId: projects.id })
      .from(projects)
      .where(eq(projects.managerUserId, userId));
    return [...new Set([...rows, ...managed].map((row) => row.projectId))];
  }

  async projectIdOfTask(taskId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ projectId: tasks.projectId })
      .from(tasks)
      .where(eq(tasks.id, taskId));
    return row?.projectId ?? null;
  }

  async projectIdOfDeliverable(deliverableId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ projectId: deliverables.projectId })
      .from(deliverables)
      .where(eq(deliverables.id, deliverableId));
    return row?.projectId ?? null;
  }

  async projectIdOfMilestone(milestoneId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ projectId: milestones.projectId })
      .from(milestones)
      .where(eq(milestones.id, milestoneId));
    return row?.projectId ?? null;
  }
}
