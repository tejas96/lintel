import { and, count, desc, eq } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { auditLog } from '../../schema';
import { loadUserSummaries, pickUser } from '../shared/user-summary.query';
import type { UserSummaryView } from '../shared/view-types';
import { loadAuditNames, referencedIds } from './audit-names.query';

export interface AuditEntryView {
  readonly id: string;
  readonly actor: UserSummaryView | null;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly before: Record<string, unknown> | null;
  readonly after: Record<string, unknown> | null;
  /** Names for ids that appear in `before`/`after` ("#12 Measure the site", "Kavya Rao"). */
  readonly names: Record<string, string>;
  readonly createdAt: string;
}

export interface AuditLogFilter {
  readonly entityType?: string | undefined;
  readonly actorUserId?: string | undefined;
  readonly page: number;
  readonly pageSize: number;
}

/** The audit trail, newest first. Request IDs and IP hashes stay internal. */
export async function queryAuditLog(
  db: DatabaseExecutor,
  filter: AuditLogFilter,
): Promise<{ items: AuditEntryView[]; totalItems: number }> {
  const where = and(
    filter.entityType ? eq(auditLog.entityType, filter.entityType) : undefined,
    filter.actorUserId ? eq(auditLog.actorUserId, filter.actorUserId) : undefined,
  );
  const [[totals], rows] = await Promise.all([
    db.select({ total: count() }).from(auditLog).where(where),
    db
      .select()
      .from(auditLog)
      .where(where)
      .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
      .limit(filter.pageSize)
      .offset((filter.page - 1) * filter.pageSize),
  ]);
  const [actors, names] = await Promise.all([
    loadUserSummaries(
      db,
      rows.map((row) => row.actorUserId),
    ),
    loadAuditNames(db, referencedIds(rows.flatMap((row) => [row.before, row.after]))),
  ]);
  return {
    items: rows.map((row) => ({
      id: row.id,
      actor: pickUser(actors, row.actorUserId),
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      before: row.before,
      after: row.after,
      names: namesFor(names, [row.before, row.after]),
      createdAt: row.createdAt.toISOString(),
    })),
    totalItems: totals?.total ?? 0,
  };
}

/** Only the names one entry refers to, so each item stays self-contained. */
function namesFor(
  all: Record<string, string>,
  snapshots: readonly unknown[],
): Record<string, string> {
  const picked: Record<string, string> = {};
  for (const id of referencedIds(snapshots)) {
    const name = all[id];
    if (name !== undefined) picked[id] = name;
  }
  return picked;
}
