import type { ProjectHealth, ProjectHealthReason } from '@lintel/domain';
import type { CalendarDate } from '@lintel/shared';
import { eq } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { projects } from '../../schema';
import { loadProjectSummaries, type ProjectSummaryView } from '../shared/project-summary.query';
import { loadUserSummaries } from '../shared/user-summary.query';
import type { UserSummaryView } from '../shared/view-types';
import {
  loadMilestoneViews,
  loadProjectMembers,
  loadStageViews,
  loadTemplateRef,
  type MilestoneView,
  type ProjectMemberView,
  type StageView,
} from './project-detail.parts';

/** Project health with plain (mutable) arrays, exactly as the contract describes it. */
export interface ProjectHealthView extends Omit<ProjectHealth, 'reasons'> {
  readonly reasons: ProjectHealthReason[];
}

export interface ProjectListItemView extends Omit<ProjectSummaryView, 'health'> {
  readonly health: ProjectHealthView;
}

export interface ProjectDetailView extends ProjectListItemView {
  readonly description: string | null;
  readonly siteAddress: string | null;
  readonly clientPhone: string | null;
  readonly clientEmail: string | null;
  readonly owner: UserSummaryView;
  readonly members: ProjectMemberView[];
  readonly stages: StageView[];
  readonly milestones: MilestoneView[];
  readonly budgetMinor: number | null;
  readonly currency: string;
  readonly template: { id: string; name: string; versionNumber: number } | null;
  readonly templateOptions: string[];
  readonly viewerCanManage: boolean;
  readonly createdAt: string;
  readonly version: number;
}

export interface ProjectDetailOptions {
  readonly today: CalendarDate;
  readonly currency: string;
  /** Decided by the application's finance visibility rule. */
  readonly canSeeBudget: boolean;
  readonly viewerCanManage: boolean;
}

export function toListItem(summary: ProjectSummaryView): ProjectListItemView {
  return { ...summary, health: { ...summary.health, reasons: [...summary.health.reasons] } };
}

/** Everything the project control room shows. Callers check access first. */
export async function loadProjectDetail(
  db: DatabaseExecutor,
  projectId: string,
  options: ProjectDetailOptions,
): Promise<ProjectDetailView | null> {
  const [[summary], [row]] = await Promise.all([
    loadProjectSummaries(db, { where: eq(projects.id, projectId), limit: 1, today: options.today }),
    db.select().from(projects).where(eq(projects.id, projectId)),
  ]);
  if (!summary || !row) return null;
  const [members, stages, milestoneViews, template, people] = await Promise.all([
    loadProjectMembers(db, projectId),
    loadStageViews(db, projectId),
    loadMilestoneViews(db, row, options.today),
    loadTemplateRef(db, row.templateVersionId),
    loadUserSummaries(db, [row.ownerUserId]),
  ]);
  return {
    ...toListItem(summary),
    description: row.description,
    siteAddress: row.siteAddress,
    clientPhone: row.clientPhone,
    clientEmail: row.clientEmail,
    owner: people.get(row.ownerUserId) ?? summary.manager,
    members,
    stages,
    milestones: milestoneViews,
    budgetMinor: options.canSeeBudget ? row.budgetMinor : null,
    currency: options.currency,
    template,
    templateOptions: row.templateOptions,
    viewerCanManage: options.viewerCanManage,
    createdAt: row.createdAt.toISOString(),
    version: row.version,
  };
}
