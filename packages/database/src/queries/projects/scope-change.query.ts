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
    shiftWorkingDays: number;
    isDownstream: boolean;
  }[];
  readonly projectEndImpactDays: number;
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

async function loadScopeChanges(db: DatabaseExecutor, where: SQL): Promise<ScopeChangeView[]> {
  const rows = await db
    .select()
    .from(scopeChangeRequests)
    .where(where)
    .orderBy(desc(scopeChangeRequests.createdAt));
  if (rows.length === 0) return [];
  const [impacts, people, additions] = await Promise.all([
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
        shiftWorkingDays: impact.shiftWorkingDays,
        isDownstream: impact.isDownstream,
      })),
    projectEndImpactDays: row.projectEndImpactDays,
    newTasks: additions.newTasks.get(row.id) ?? [],
    cancellations: additions.cancellations.get(row.id) ?? [],
    createdAt: row.createdAt.toISOString(),
    version: row.version,
  }));
}

/** Scope changes of one project, newest first. Callers check project access first. */
export function listScopeChanges(db: DatabaseExecutor, projectId: string) {
  return loadScopeChanges(db, eq(scopeChangeRequests.projectId, projectId));
}

export async function findScopeChange(
  db: DatabaseExecutor,
  scopeChangeId: string,
): Promise<ScopeChangeView | null> {
  const [view] = await loadScopeChanges(db, eq(scopeChangeRequests.id, scopeChangeId));
  return view ?? null;
}
