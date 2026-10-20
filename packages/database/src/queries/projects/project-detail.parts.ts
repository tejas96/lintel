import type { ProjectRole, ProjectStatus } from '@lintel/domain';
import type { CalendarDate } from '@lintel/shared';
import { and, asc, count, eq, isNull, sql } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import {
  milestones,
  projectMembers,
  projectStages,
  tasks,
  users,
  workflowTemplates,
  workflowTemplateVersions,
} from '../../schema';
import { loadProjectHealth } from '../shared/project-health.loader';
import { userSummaryColumns } from '../shared/user-summary.query';
import type { UserSummaryView } from '../shared/view-types';

export interface ProjectMemberView {
  readonly user: UserSummaryView;
  readonly projectRole: ProjectRole;
}

export interface StageView {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly position: number;
  readonly status: 'pending' | 'active' | 'completed' | 'skipped';
  readonly plannedStartDate: string | null;
  readonly plannedEndDate: string | null;
  readonly taskCounts: { readonly total: number; readonly done: number; readonly blocked: number };
}

export interface MilestoneView {
  readonly id: string;
  readonly stageId: string | null;
  readonly name: string;
  readonly dueDate: string;
  readonly baselineDueDate: string;
  readonly status: 'pending' | 'completed' | 'cancelled';
  readonly health: 'completed' | 'on_track' | 'at_risk' | 'missed';
  readonly riskReasons: string[];
  readonly requiresClientApproval: boolean;
  readonly openTaskCount: number;
  readonly completedAt: string | null;
  readonly version: number;
}

/** The team, manager first, then in the order people joined. */
export async function loadProjectMembers(
  db: DatabaseExecutor,
  projectId: string,
): Promise<ProjectMemberView[]> {
  const rows = await db
    .select({ user: userSummaryColumns, projectRole: projectMembers.projectRole })
    .from(projectMembers)
    .innerJoin(users, eq(users.id, projectMembers.userId))
    .where(eq(projectMembers.projectId, projectId))
    .orderBy(
      sql`case when ${projectMembers.projectRole} = 'manager' then 0 else 1 end`,
      asc(projectMembers.addedAt),
    );
  return rows;
}

export async function loadStageViews(
  db: DatabaseExecutor,
  projectId: string,
): Promise<StageView[]> {
  const [stages, counts] = await Promise.all([
    db
      .select()
      .from(projectStages)
      .where(eq(projectStages.projectId, projectId))
      .orderBy(asc(projectStages.position)),
    db
      .select({
        stageId: tasks.stageId,
        total: count(),
        done: sql<number>`count(*) filter (where ${tasks.status} = 'done')::int`,
        blocked: sql<number>`count(*) filter (where ${tasks.status} = 'blocked')::int`,
      })
      .from(tasks)
      .where(and(eq(tasks.projectId, projectId), isNull(tasks.archivedAt)))
      .groupBy(tasks.stageId),
  ]);
  const byStage = new Map(counts.map((row) => [row.stageId, row]));
  return stages.map((stage) => {
    const row = byStage.get(stage.id);
    return {
      id: stage.id,
      name: stage.name,
      description: stage.description,
      position: stage.position,
      status: stage.status,
      plannedStartDate: stage.plannedStartDate,
      plannedEndDate: stage.plannedEndDate,
      taskCounts: { total: row?.total ?? 0, done: row?.done ?? 0, blocked: row?.blocked ?? 0 },
    };
  });
}

/** Milestones with the shared health assessment (risk reasons included). */
export async function loadMilestoneViews(
  db: DatabaseExecutor,
  project: { id: string; status: ProjectStatus; plannedEndDate: string },
  today: CalendarDate,
): Promise<MilestoneView[]> {
  const [rows, health] = await Promise.all([
    db
      .select()
      .from(milestones)
      .where(eq(milestones.projectId, project.id))
      .orderBy(asc(milestones.position), asc(milestones.dueDate)),
    loadProjectHealth(db, [project], today),
  ]);
  const risk = health.get(project.id)?.milestoneRisk;
  return rows.map((row) => {
    const assessment = risk?.get(row.id);
    return {
      id: row.id,
      stageId: row.stageId,
      name: row.name,
      dueDate: row.dueDate,
      baselineDueDate: row.baselineDueDate,
      status: row.status,
      health: assessment?.health ?? (row.status === 'pending' ? 'on_track' : 'completed'),
      riskReasons: [...(assessment?.reasons ?? [])],
      requiresClientApproval: row.requiresClientApproval,
      openTaskCount: assessment?.openTaskCount ?? 0,
      completedAt: row.completedAt?.toISOString() ?? null,
      version: row.version,
    };
  });
}

export async function loadTemplateRef(
  db: DatabaseExecutor,
  templateVersionId: string | null,
): Promise<{ id: string; name: string; versionNumber: number } | null> {
  if (!templateVersionId) return null;
  const [row] = await db
    .select({
      id: workflowTemplates.id,
      name: workflowTemplates.name,
      versionNumber: workflowTemplateVersions.versionNumber,
    })
    .from(workflowTemplateVersions)
    .innerJoin(workflowTemplates, eq(workflowTemplates.id, workflowTemplateVersions.templateId))
    .where(eq(workflowTemplateVersions.id, templateVersionId));
  return row ?? null;
}
