import type {
  MilestoneRowChanges,
  NewMilestoneRow,
  NewStageRow,
  NewTemplateTaskRow,
  StageRowChanges,
  TemplateTaskChanges,
  TemplateUpdateStore,
  TemplateUpdateSummary,
} from '@lintel/application';
import { OPEN_TASK_STATUSES } from '@lintel/domain';
import { and, count, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { DatabaseExecutor } from '../client';
import {
  deliverables,
  milestones,
  projectStages,
  projects,
  projectTemplateUpdates,
  taskChecklistItems,
  tasks,
} from '../schema';
import { insertTemplateTasks } from './template-task.inserter';
import { loadWorkflowSnapshot } from './template-update.snapshot';

const projectColumns = {
  id: projects.id,
  name: projects.name,
  templateVersionId: projects.templateVersionId,
  templateOptions: projects.templateOptions,
  plannedEndDate: projects.plannedEndDate,
  managerUserId: projects.managerUserId,
  version: projects.version,
};

/** Reads a project's workflow for a template update and writes each part of it. */
export class TemplateUpdateRepository implements TemplateUpdateStore {
  constructor(private readonly db: DatabaseExecutor) {}

  async project(projectId: string) {
    const [row] = await this.db
      .select(projectColumns)
      .from(projects)
      .where(eq(projects.id, projectId));
    return row ?? null;
  }

  async projectForUpdate(projectId: string) {
    const [row] = await this.db
      .select(projectColumns)
      .from(projects)
      .where(eq(projects.id, projectId))
      .for('update');
    return row ?? null;
  }

  snapshot(projectId: string) {
    return loadWorkflowSnapshot(this.db, projectId);
  }

  async nextTaskNumber(projectId: string) {
    const [last] = await this.db
      .select({ number: sql<number>`coalesce(max(${tasks.number}), 0)::int` })
      .from(tasks)
      .where(eq(tasks.projectId, projectId));
    return (last?.number ?? 0) + 1;
  }

  async insertStage(projectId: string, stage: NewStageRow) {
    const [row] = await this.db
      .insert(projectStages)
      .values({ projectId, ...stage, startedAt: stage.status === 'active' ? new Date() : null })
      .returning({ id: projectStages.id });
    if (!row) throw new Error('Saving the stage returned no row.');
    return row.id;
  }

  async updateStage(stageId: string, changes: StageRowChanges) {
    if (Object.keys(changes).length === 0) return;
    await this.db
      .update(projectStages)
      .set({ ...changes, updatedAt: new Date() })
      .where(eq(projectStages.id, stageId));
  }

  async extendStageDates(stageId: string, start: string, end: string) {
    await this.db
      .update(projectStages)
      .set({
        plannedStartDate: sql`least(coalesce(${projectStages.plannedStartDate}, ${start}::date), ${start}::date)`,
        plannedEndDate: sql`greatest(coalesce(${projectStages.plannedEndDate}, ${end}::date), ${end}::date)`,
        updatedAt: new Date(),
      })
      .where(eq(projectStages.id, stageId));
  }

  async insertMilestone(projectId: string, milestone: NewMilestoneRow) {
    const [row] = await this.db
      .insert(milestones)
      .values({ projectId, ...milestone, baselineDueDate: milestone.dueDate })
      .returning({ id: milestones.id });
    if (!row) throw new Error('Saving the milestone returned no row.');
    return row.id;
  }

  async updateMilestone(milestoneId: string, changes: MilestoneRowChanges) {
    if (Object.keys(changes).length === 0) return;
    await this.db
      .update(milestones)
      .set({ ...changes, version: sql`${milestones.version} + 1`, updatedAt: new Date() })
      .where(eq(milestones.id, milestoneId));
  }

  insertTasks(projectId: string, createdByUserId: string, rows: readonly NewTemplateTaskRow[]) {
    return insertTemplateTasks(this.db, projectId, createdByUserId, rows);
  }

  async updateTask(taskId: string, changes: TemplateTaskChanges) {
    await this.db
      .update(tasks)
      .set({ ...changes, version: sql`${tasks.version} + 1`, updatedAt: new Date() })
      .where(eq(tasks.id, taskId));
  }

  async removeOpenChecklistItems(taskId: string, labels: readonly string[]) {
    if (labels.length === 0) return;
    await this.db
      .delete(taskChecklistItems)
      .where(
        and(
          eq(taskChecklistItems.taskId, taskId),
          inArray(taskChecklistItems.label, [...labels]),
          isNull(taskChecklistItems.completedAt),
        ),
      );
  }

  async addDeliverables(
    projectId: string,
    taskId: string,
    rows: readonly { name: string; isRequired: boolean; reviewerUserId: string | null }[],
  ) {
    if (rows.length === 0) return;
    await this.db
      .insert(deliverables)
      .values(rows.map((row) => ({ projectId, taskId, status: 'not_submitted' as const, ...row })));
  }

  async cancelUnsubmittedDeliverables(taskId: string, names: readonly string[]) {
    if (names.length === 0) return;
    await this.db
      .update(deliverables)
      .set({
        status: 'cancelled',
        version: sql`${deliverables.version} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(deliverables.taskId, taskId),
          inArray(deliverables.name, [...names]),
          eq(deliverables.currentVersionNumber, 0),
        ),
      );
  }

  async unstartedSubtaskIds(taskId: string) {
    const rows = await this.db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.parentTaskId, taskId), inArray(tasks.status, ['draft', 'ready'])));
    return rows.map((row) => row.id);
  }

  async stageHasOpenTasks(stageId: string) {
    const [row] = await this.db
      .select({ total: count() })
      .from(tasks)
      .where(
        and(
          eq(tasks.stageId, stageId),
          inArray(tasks.status, [...OPEN_TASK_STATUSES]),
          isNull(tasks.archivedAt),
        ),
      );
    return (row?.total ?? 0) > 0;
  }

  async moveProject(
    projectId: string,
    expectedVersion: number,
    toVersionId: string,
    plannedEndDate: string | null,
  ) {
    const rows = await this.db
      .update(projects)
      .set({
        templateVersionId: toVersionId,
        ...(plannedEndDate ? { plannedEndDate } : {}),
        version: sql`${projects.version} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(projects.id, projectId), eq(projects.version, expectedVersion)))
      .returning({ id: projects.id });
    return rows.length > 0;
  }

  async recordUpdate(entry: {
    readonly projectId: string;
    readonly fromVersionId: string;
    readonly toVersionId: string;
    readonly appliedByUserId: string;
    readonly summary: TemplateUpdateSummary;
  }) {
    await this.db.insert(projectTemplateUpdates).values(entry);
  }
}
