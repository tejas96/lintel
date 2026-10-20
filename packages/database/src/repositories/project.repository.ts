import {
  type NewProject,
  type NewProjectPlan,
  type ProjectDetailsInput,
  type ProjectMemberInput,
  type ProjectRecord,
  type ProjectStatusChange,
  type ProjectStore,
  projectReferenceSeriesPattern,
} from '@lintel/application';
import { OPEN_TASK_STATUSES } from '@lintel/domain';
import { definedOnly, type Patch } from '@lintel/shared';
import { and, asc, count, eq, inArray, isNull, like, sql } from 'drizzle-orm';
import type { DatabaseExecutor } from '../client';
import { milestones, projectMembers, projects, tasks, users } from '../schema';
import { insertProjectPlan } from './project-plan.writer';
import { completeStageAndActivateNext, stageIsClosed } from './project-stage.writer';

function toProject(row: typeof projects.$inferSelect): ProjectRecord {
  return {
    id: row.id,
    reference: row.reference,
    name: row.name,
    clientName: row.clientName,
    clientPhone: row.clientPhone,
    clientEmail: row.clientEmail,
    siteAddress: row.siteAddress,
    description: row.description,
    projectType: row.projectType,
    status: row.status,
    criticality: row.criticality,
    ownerUserId: row.ownerUserId,
    managerUserId: row.managerUserId,
    plannedStartDate: row.plannedStartDate,
    plannedEndDate: row.plannedEndDate,
    budgetMinor: row.budgetMinor,
    version: row.version,
  };
}

const openTaskColumns = {
  id: tasks.id,
  number: tasks.number,
  title: tasks.title,
  ownerUserId: tasks.ownerUserId,
};

const isOpenTask = () =>
  and(inArray(tasks.status, [...OPEN_TASK_STATUSES]), isNull(tasks.archivedAt));

export class ProjectRepository implements ProjectStore {
  constructor(private readonly db: DatabaseExecutor) {}

  async referencesInSeries(prefix: string, year: number) {
    const series = projectReferenceSeriesPattern(prefix, year);
    // Serialises reference allocation per series until the transaction ends.
    await this.db.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`project-reference:${series}`}))`,
    );
    const rows = await this.db
      .select({ reference: projects.reference })
      .from(projects)
      .where(like(projects.reference, series));
    return rows.map((row) => row.reference);
  }

  async projectCount() {
    const [row] = await this.db.select({ total: count() }).from(projects);
    return row?.total ?? 0;
  }

  async activeUserIds(userIds: readonly string[]) {
    if (userIds.length === 0) return new Set<string>();
    const rows = await this.db
      .select({ id: users.id })
      .from(users)
      .where(and(inArray(users.id, [...userIds]), eq(users.status, 'active')));
    return new Set(rows.map((row) => row.id));
  }

  async userNames(userIds: readonly string[]) {
    if (userIds.length === 0) return new Map<string, string>();
    const rows = await this.db
      .select({ id: users.id, fullName: users.fullName })
      .from(users)
      .where(inArray(users.id, [...userIds]));
    return new Map(rows.map((row) => [row.id, row.fullName]));
  }

  async insertProject(project: NewProject) {
    const [row] = await this.db
      .insert(projects)
      .values({
        ...project,
        templateOptions: [...project.templateOptions],
        baselineEndDate: project.plannedEndDate,
        status: 'active',
      })
      .returning({ id: projects.id });
    if (!row) throw new Error('Creating the project returned no row.');
    return row;
  }

  insertPlan(projectId: string, createdByUserId: string, plan: NewProjectPlan) {
    return insertProjectPlan(this.db, projectId, createdByUserId, plan);
  }

  async findById(projectId: string) {
    const [row] = await this.db.select().from(projects).where(eq(projects.id, projectId));
    return row ? toProject(row) : null;
  }

  async update(projectId: string, expectedVersion: number, changes: Patch<ProjectDetailsInput>) {
    const [row] = await this.db
      .update(projects)
      .set({
        ...definedOnly(changes),
        version: sql`${projects.version} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(projects.id, projectId), eq(projects.version, expectedVersion)))
      .returning();
    return row ? toProject(row) : null;
  }

  async changeStatus(projectId: string, expectedVersion: number, change: ProjectStatusChange) {
    const [row] = await this.db
      .update(projects)
      .set({
        status: change.status,
        ...(change.actualEndDate !== undefined ? { actualEndDate: change.actualEndDate } : {}),
        ...(change.archivedAt !== undefined ? { archivedAt: change.archivedAt } : {}),
        version: sql`${projects.version} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(projects.id, projectId), eq(projects.version, expectedVersion)))
      .returning();
    return row ? toProject(row) : null;
  }

  async members(projectId: string): Promise<ProjectMemberInput[]> {
    return this.db
      .select({ userId: projectMembers.userId, projectRole: projectMembers.projectRole })
      .from(projectMembers)
      .where(eq(projectMembers.projectId, projectId))
      .orderBy(asc(projectMembers.addedAt));
  }

  async replaceMembers(projectId: string, members: readonly ProjectMemberInput[]) {
    const current = await this.members(projectId);
    const wanted = new Map(members.map((member) => [member.userId, member.projectRole]));
    const removed = current.filter((member) => !wanted.has(member.userId));
    if (removed.length > 0) {
      await this.db.delete(projectMembers).where(
        and(
          eq(projectMembers.projectId, projectId),
          inArray(
            projectMembers.userId,
            removed.map((member) => member.userId),
          ),
        ),
      );
    }
    if (members.length === 0) return;
    // Upsert keeps `addedAt` for people who stay, so the team order is stable.
    await this.db
      .insert(projectMembers)
      .values(members.map((member) => ({ projectId, ...member })))
      .onConflictDoUpdate({
        target: [projectMembers.projectId, projectMembers.userId],
        set: { projectRole: sql`excluded.project_role` },
      });
  }

  async openTasks(projectId: string) {
    return this.db
      .select(openTaskColumns)
      .from(tasks)
      .where(and(eq(tasks.projectId, projectId), isOpenTask()))
      .orderBy(asc(tasks.number));
  }

  async findMilestone(milestoneId: string) {
    const [row] = await this.db.select().from(milestones).where(eq(milestones.id, milestoneId));
    return row
      ? {
          id: row.id,
          projectId: row.projectId,
          stageId: row.stageId,
          name: row.name,
          status: row.status,
          version: row.version,
        }
      : null;
  }

  async openTasksOfMilestone(milestoneId: string) {
    return this.db
      .select(openTaskColumns)
      .from(tasks)
      .where(and(eq(tasks.milestoneId, milestoneId), isOpenTask()))
      .orderBy(asc(tasks.number));
  }

  async completeMilestone(
    milestoneId: string,
    expectedVersion: number,
    completedByUserId: string,
    at: Date,
  ) {
    const rows = await this.db
      .update(milestones)
      .set({
        status: 'completed',
        completedAt: at,
        completedByUserId,
        version: sql`${milestones.version} + 1`,
        updatedAt: at,
      })
      .where(
        and(
          eq(milestones.id, milestoneId),
          eq(milestones.version, expectedVersion),
          eq(milestones.status, 'pending'),
        ),
      )
      .returning({ id: milestones.id });
    return rows.length > 0;
  }

  stageIsClosed(stageId: string) {
    return stageIsClosed(this.db, stageId);
  }

  completeStageAndActivateNext(stageId: string, at: Date) {
    return completeStageAndActivateNext(this.db, stageId, at);
  }
}
