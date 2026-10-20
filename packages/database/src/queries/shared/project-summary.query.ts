import type { ProjectCriticality, ProjectHealth, ProjectStatus, ProjectType } from '@lintel/domain';
import type { CalendarDate } from '@lintel/shared';
import { and, asc, eq, inArray, type SQL } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { milestones, projectStages, projects } from '../../schema';
import { loadProjectHealth } from './project-health.loader';
import { loadUserSummaries } from './user-summary.query';
import type { ProjectRefView, UserSummaryView } from './view-types';

export interface ProjectSummaryView extends ProjectRefView {
  readonly clientName: string;
  readonly projectType: ProjectType;
  readonly status: ProjectStatus;
  readonly criticality: ProjectCriticality;
  readonly manager: UserSummaryView;
  readonly plannedStartDate: string;
  readonly plannedEndDate: string;
  readonly baselineEndDate: string;
  readonly health: ProjectHealth;
  readonly currentStage: { id: string; name: string; position: number; totalStages: number } | null;
  readonly nextMilestone: { id: string; name: string; dueDate: string } | null;
}

export interface ProjectSummaryQuery {
  readonly where?: SQL | undefined;
  readonly orderBy?: SQL[];
  readonly limit?: number;
  readonly offset?: number;
  readonly today: CalendarDate;
}

const UNKNOWN_PERSON: UserSummaryView = {
  id: '00000000-0000-0000-0000-000000000000',
  fullName: 'Unknown',
  designation: null,
  role: 'employee',
  avatarHue: 0,
  status: 'deactivated',
};

/** The one way to build ProjectSummary views (list, dashboard, mobile home). */
export async function loadProjectSummaries(
  db: DatabaseExecutor,
  query: ProjectSummaryQuery,
): Promise<ProjectSummaryView[]> {
  const rows = await db
    .select()
    .from(projects)
    .where(and(query.where))
    .orderBy(...(query.orderBy ?? [asc(projects.plannedEndDate)]))
    .limit(query.limit ?? 100)
    .offset(query.offset ?? 0);
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const [stageRows, milestoneRows, managers, health] = await Promise.all([
    db
      .select()
      .from(projectStages)
      .where(inArray(projectStages.projectId, ids))
      .orderBy(asc(projectStages.position)),
    db
      .select()
      .from(milestones)
      .where(and(inArray(milestones.projectId, ids), eq(milestones.status, 'pending')))
      .orderBy(asc(milestones.dueDate)),
    loadUserSummaries(
      db,
      rows.map((row) => row.managerUserId),
    ),
    loadProjectHealth(db, rows, query.today),
  ]);
  return rows.map((row) => {
    const stages = stageRows.filter((stage) => stage.projectId === row.id);
    const current =
      stages.find((stage) => stage.status === 'active') ??
      stages.find((stage) => stage.status === 'pending') ??
      null;
    const next = milestoneRows.find((milestone) => milestone.projectId === row.id) ?? null;
    const bundle = health.get(row.id);
    if (!bundle) throw new Error(`Health missing for project ${row.id}`);
    return {
      id: row.id,
      reference: row.reference,
      name: row.name,
      colorIndex: row.colorIndex,
      clientName: row.clientName,
      projectType: row.projectType,
      status: row.status,
      criticality: row.criticality,
      manager: managers.get(row.managerUserId) ?? UNKNOWN_PERSON,
      plannedStartDate: row.plannedStartDate,
      plannedEndDate: row.plannedEndDate,
      baselineEndDate: row.baselineEndDate,
      health: bundle.health,
      currentStage: current
        ? {
            id: current.id,
            name: current.name,
            position: current.position,
            totalStages: stages.length,
          }
        : null,
      nextMilestone: next ? { id: next.id, name: next.name, dueDate: next.dueDate } : null,
    };
  });
}
