import type { ProjectCostCategory } from '@lintel/domain';
import { asc, desc, eq, inArray, type SQL } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { scopeChangeRequests, scopeChangeTaskImpacts, tasks } from '../../schema';
import { loadUserSummaries, pickUser } from '../shared/user-summary.query';
import type { UserSummaryView } from '../shared/view-types';
import {
  loadScopeAdditionViews,
  type ScopeCancellationView,
  type ScopeNewTaskView,
} from './scope-change-additions.query';
import { type ClientSignOffView, loadClientSignOffViews } from './scope-change-sign-offs.query';

/** Money terms of a change; only for people who may see the project budget. */
export interface ScopeChangeMoneyView {
  readonly costImpactMinor: number | null;
  readonly costCategory: ProjectCostCategory | null;
  readonly feeImpactMinor: number | null;
}

export interface ScopeChangeViewer {
  /** False hides the money terms (they come back as null). */
  readonly canSeeMoney: boolean;
}

export interface ScopeChangeView {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly description: string;
  readonly status: 'proposed' | 'approved' | 'rejected' | 'withdrawn';
  readonly requestedBy: UserSummaryView;
  readonly decidedBy: UserSummaryView | null;
  readonly decidedAt: string | null;
  readonly decisionNote: string | null;
  readonly impacts: {
    taskId: string;
    taskTitle: string;
    currentDueDate: string | null;
    proposedDueDate: string | null;
    currentStartDate: string | null;
    proposedStartDate: string | null;
    shiftWorkingDays: number;
    isDownstream: boolean;
    appliesExactDates: boolean;
  }[];
  readonly projectEndImpactDays: number;
  readonly requiresClientSignOff: boolean;
  /** Newest first; the first one counts. */
  readonly clientSignOffs: ClientSignOffView[];
  /** Null when the viewer may not see the budget. */
  readonly money: ScopeChangeMoneyView | null;
  readonly newTasks: ScopeNewTaskView[];
  readonly cancellations: ScopeCancellationView[];
  readonly createdAt: string;
  readonly version: number;
}

const FORMER_MEMBER: UserSummaryView = {
  id: '00000000-0000-0000-0000-000000000000',
  fullName: 'Former member',
  designation: null,
  role: 'employee',
  avatarHue: 0,
  status: 'deactivated',
};

async function loadScopeChanges(
  db: DatabaseExecutor,
  where: SQL,
  viewer: ScopeChangeViewer,
): Promise<ScopeChangeView[]> {
  const rows = await db
    .select()
    .from(scopeChangeRequests)
    .where(where)
    .orderBy(desc(scopeChangeRequests.createdAt));
  if (rows.length === 0) return [];
  const [impacts, people, additions, signOffs] = await Promise.all([
    db
      .select({ impact: scopeChangeTaskImpacts, taskTitle: tasks.title, number: tasks.number })
      .from(scopeChangeTaskImpacts)
      .innerJoin(tasks, eq(tasks.id, scopeChangeTaskImpacts.taskId))
      .where(
        inArray(
          scopeChangeTaskImpacts.scopeChangeId,
          rows.map((row) => row.id),
        ),
      )
      .orderBy(asc(tasks.number)),
    loadUserSummaries(
      db,
      rows.flatMap((row) => [row.requestedByUserId, row.decidedByUserId]),
    ),
    loadScopeAdditionViews(
      db,
      rows.map((row) => row.id),
    ),
    loadClientSignOffViews(
      db,
      rows.map((row) => row.id),
    ),
  ]);
  return rows.map((row) => ({
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    description: row.description,
    status: row.status,
    requestedBy: pickUser(people, row.requestedByUserId) ?? FORMER_MEMBER,
    decidedBy: pickUser(people, row.decidedByUserId),
    decidedAt: row.decidedAt?.toISOString() ?? null,
    decisionNote: row.decisionNote,
    impacts: impacts
      .filter(({ impact }) => impact.scopeChangeId === row.id)
      .map(({ impact, taskTitle }) => ({
        taskId: impact.taskId,
        taskTitle,
        currentDueDate: impact.currentDueDate,
        proposedDueDate: impact.proposedDueDate,
        currentStartDate: impact.currentStartDate,
        proposedStartDate: impact.proposedStartDate,
        shiftWorkingDays: impact.shiftWorkingDays,
        isDownstream: impact.isDownstream,
        appliesExactDates: impact.appliesExactDates,
      })),
    projectEndImpactDays: row.projectEndImpactDays,
    requiresClientSignOff: row.requiresClientSignOff,
    clientSignOffs: signOffs.get(row.id) ?? [],
    money: viewer.canSeeMoney
      ? {
          costImpactMinor: row.costImpactMinor,
          costCategory: row.costCategory,
          feeImpactMinor: row.feeImpactMinor,
        }
      : null,
    newTasks: additions.newTasks.get(row.id) ?? [],
    cancellations: additions.cancellations.get(row.id) ?? [],
    createdAt: row.createdAt.toISOString(),
    version: row.version,
  }));
}

/** Scope changes of one project, newest first. Callers check project access first. */
export function listScopeChanges(
  db: DatabaseExecutor,
  projectId: string,
  viewer: ScopeChangeViewer,
) {
  return loadScopeChanges(db, eq(scopeChangeRequests.projectId, projectId), viewer);
}

export async function findScopeChange(
  db: DatabaseExecutor,
  scopeChangeId: string,
  viewer: ScopeChangeViewer,
): Promise<ScopeChangeView | null> {
  const [view] = await loadScopeChanges(db, eq(scopeChangeRequests.id, scopeChangeId), viewer);
  return view ?? null;
}
