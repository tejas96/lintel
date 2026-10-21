import {
  assessProfitability,
  type MarginIndicator,
  PROJECT_COST_CATEGORIES,
  type ProjectCostCategory,
} from '@lintel/domain';
import { and, count, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { projectCostEntries, projects } from '../../schema';
import { loadUserSummaries, pickUser } from '../shared/user-summary.query';
import type { UserSummaryView } from '../shared/view-types';

export interface ProjectCostEntryView {
  readonly id: string;
  readonly entryDate: string;
  readonly category: ProjectCostCategory;
  readonly amountMinor: number;
  readonly currency: string;
  readonly note: string | null;
  readonly recordedBy: UserSummaryView;
  readonly createdAt: string;
  readonly voidedAt: string | null;
  readonly voidedBy: UserSummaryView | null;
  readonly voidReason: string | null;
  /** Set when the entry records the cost of an approved scope change. */
  readonly scopeChangeId: string | null;
  readonly version: number;
}

export interface ProjectProfitabilityView {
  readonly projectId: string;
  readonly currency: string;
  readonly budgetMinor: number | null;
  readonly recordedCostMinor: number;
  readonly remainingMinor: number | null;
  readonly marginRatio: number | null;
  readonly indicator: MarginIndicator;
  readonly byCategory: { category: ProjectCostCategory; amountMinor: number }[];
  readonly entries: ProjectCostEntryView[];
  readonly entryCount: number;
}

const LEDGER_LIMIT = 100;

/** Recorded (not voided) cost per project, in minor units. Projects without entries are absent. */
export async function recordedCostByProject(
  db: DatabaseExecutor,
  projectIds: readonly string[],
): Promise<Map<string, number>> {
  if (projectIds.length === 0) return new Map();
  const rows = await db
    .select({
      projectId: projectCostEntries.projectId,
      total: sql<string>`sum(${projectCostEntries.amountMinor})`,
    })
    .from(projectCostEntries)
    .where(
      and(
        inArray(projectCostEntries.projectId, [...projectIds]),
        isNull(projectCostEntries.voidedAt),
      ),
    )
    .groupBy(projectCostEntries.projectId);
  return new Map(rows.map((row) => [row.projectId, Number(row.total)]));
}

/** Converts ledger rows (or the command's records) to views, resolving who recorded and voided them. */
export async function toCostEntryViews(
  db: DatabaseExecutor,
  rows: readonly Omit<typeof projectCostEntries.$inferSelect, 'updatedAt' | 'projectId'>[],
): Promise<ProjectCostEntryView[]> {
  const people = await loadUserSummaries(
    db,
    rows.flatMap((row) => [row.recordedByUserId, row.voidedByUserId]),
  );
  return rows.flatMap((row) => {
    const recordedBy = pickUser(people, row.recordedByUserId);
    if (!recordedBy) return [];
    return [
      {
        id: row.id,
        entryDate: row.entryDate,
        category: row.category,
        amountMinor: row.amountMinor,
        currency: row.currency,
        note: row.note,
        recordedBy,
        createdAt: row.createdAt.toISOString(),
        voidedAt: row.voidedAt?.toISOString() ?? null,
        voidedBy: pickUser(people, row.voidedByUserId),
        voidReason: row.voidReason,
        scopeChangeId: row.scopeChangeId,
        version: row.version,
      },
    ];
  });
}

/**
 * Budget against recorded cost for one project, with the newest ledger
 * entries. Callers check finance access first. Recorded cost = the sum of
 * entries that are not voided; see `assessProfitability` for the margin.
 */
export async function loadProjectProfitability(
  db: DatabaseExecutor,
  projectId: string,
  currency: string,
): Promise<ProjectProfitabilityView | null> {
  const [project] = await db
    .select({ id: projects.id, budgetMinor: projects.budgetMinor })
    .from(projects)
    .where(eq(projects.id, projectId));
  if (!project) return null;
  const [categories, rows, [total]] = await Promise.all([
    db
      .select({
        category: projectCostEntries.category,
        total: sql<string>`sum(${projectCostEntries.amountMinor})`,
      })
      .from(projectCostEntries)
      .where(and(eq(projectCostEntries.projectId, projectId), isNull(projectCostEntries.voidedAt)))
      .groupBy(projectCostEntries.category),
    db
      .select()
      .from(projectCostEntries)
      .where(eq(projectCostEntries.projectId, projectId))
      .orderBy(desc(projectCostEntries.entryDate), desc(projectCostEntries.createdAt))
      .limit(LEDGER_LIMIT),
    db
      .select({ total: count() })
      .from(projectCostEntries)
      .where(eq(projectCostEntries.projectId, projectId)),
  ]);
  const byCategory = PROJECT_COST_CATEGORIES.map((category) => ({
    category,
    amountMinor: Number(categories.find((row) => row.category === category)?.total ?? 0),
  }));
  const recorded = byCategory.reduce((sum, row) => sum + row.amountMinor, 0);
  return {
    projectId,
    currency,
    ...assessProfitability(project.budgetMinor, recorded),
    byCategory,
    entries: await toCostEntryViews(db, rows),
    entryCount: total?.total ?? 0,
  };
}
