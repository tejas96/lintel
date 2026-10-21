import { inArray, sql } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { leaveRequests } from '../../schema';

export interface LeaveTypeUsage {
  readonly requestCount: number;
  readonly openRequestCount: number;
}

const NO_USAGE: LeaveTypeUsage = { requestCount: 0, openRequestCount: 0 };

/** How often each leave type was used, so retiring one is an informed choice. */
export async function loadLeaveTypeUsage(
  db: DatabaseExecutor,
  leaveTypeIds: readonly string[],
): Promise<(leaveTypeId: string) => LeaveTypeUsage> {
  if (leaveTypeIds.length === 0) return () => NO_USAGE;
  const rows = await db
    .select({
      leaveTypeId: leaveRequests.leaveTypeId,
      requestCount: sql<number>`count(*)::int`,
      openRequestCount: sql<number>`count(*) filter (where ${leaveRequests.status} in ('pending', 'info_requested'))::int`,
    })
    .from(leaveRequests)
    .where(inArray(leaveRequests.leaveTypeId, [...leaveTypeIds]))
    .groupBy(leaveRequests.leaveTypeId);
  const byType = new Map(rows.map((row) => [row.leaveTypeId, row]));
  return (leaveTypeId) => {
    const row = byType.get(leaveTypeId);
    return row
      ? { requestCount: row.requestCount, openRequestCount: row.openRequestCount }
      : NO_USAGE;
  };
}
