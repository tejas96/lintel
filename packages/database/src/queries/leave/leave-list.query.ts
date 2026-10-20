import type { LeaveListFilter } from '@lintel/application';
import type { LeaveStatus } from '@lintel/domain';
import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  gte,
  inArray,
  lte,
  ne,
  or,
  type SQL,
} from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { leaveApprovalSteps, leaveRequests, leaveTypes, users } from '../../schema';
import { type LeaveRequestView, loadLeaveRequestViews } from './leave-request.view';

export interface LeaveListQuery {
  readonly filter: LeaveListFilter;
  readonly status: 'open' | 'all' | LeaveStatus;
  readonly from?: string | undefined;
  readonly to?: string | undefined;
  readonly page: number;
  readonly pageSize: number;
}

function scopeCondition(db: DatabaseExecutor, filter: LeaveListFilter): SQL | undefined {
  switch (filter.kind) {
    case 'requester':
      return eq(leaveRequests.userId, filter.userId);
    case 'approver':
      return and(
        eq(leaveRequests.status, 'pending'),
        exists(
          db
            .select({ id: leaveApprovalSteps.id })
            .from(leaveApprovalSteps)
            .where(
              and(
                eq(leaveApprovalSteps.leaveRequestId, leaveRequests.id),
                eq(leaveApprovalSteps.approverUserId, filter.userId),
                eq(leaveApprovalSteps.status, 'pending'),
              ),
            ),
        ),
      );
    case 'any_pending':
      return and(
        eq(leaveRequests.status, 'pending'),
        ne(leaveRequests.userId, filter.excludeUserId),
      );
    case 'team': {
      const related = or(
        eq(users.reportsToUserId, filter.managerUserId),
        filter.teamId ? eq(users.teamId, filter.teamId) : undefined,
      );
      const people = db.select({ id: users.id }).from(users).where(related);
      return and(
        inArray(leaveRequests.userId, people),
        ne(leaveRequests.userId, filter.managerUserId),
      );
    }
    case 'all':
      return undefined;
  }
}

function statusCondition(status: LeaveListQuery['status']): SQL | undefined {
  if (status === 'all') return undefined;
  if (status === 'open') return inArray(leaveRequests.status, ['pending', 'info_requested']);
  return eq(leaveRequests.status, status);
}

/** Paginated leave list for a resolved scope (see `LeaveQueries.listFilter`). */
export async function queryLeaveRequests(
  db: DatabaseExecutor,
  query: LeaveListQuery,
): Promise<{ items: LeaveRequestView[]; totalItems: number }> {
  const where = and(
    scopeCondition(db, query.filter),
    statusCondition(query.status),
    query.to ? lte(leaveRequests.startDate, query.to) : undefined,
    query.from ? gte(leaveRequests.endDate, query.from) : undefined,
  );
  const [totals] = await db.select({ total: count() }).from(leaveRequests).where(where);
  const waitingFirst = query.filter.kind === 'approver' || query.filter.kind === 'any_pending';
  const items = await loadLeaveRequestViews(db, {
    where,
    orderBy: waitingFirst
      ? [asc(leaveRequests.startDate), asc(leaveRequests.createdAt)]
      : [desc(leaveRequests.startDate), desc(leaveRequests.createdAt)],
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  });
  return { items, totalItems: totals?.total ?? 0 };
}

/** Leave types people can choose; leave administrators also see retired ones. */
export async function listLeaveTypes(db: DatabaseExecutor, includeInactive: boolean) {
  return db
    .select({
      id: leaveTypes.id,
      code: leaveTypes.code,
      name: leaveTypes.name,
      description: leaveTypes.description,
      requiresReason: leaveTypes.requiresReason,
      allowsHalfDay: leaveTypes.allowsHalfDay,
      minimumNoticeDays: leaveTypes.minimumNoticeDays,
      annualAllowanceHalfDays: leaveTypes.annualAllowanceHalfDays,
      colorIndex: leaveTypes.colorIndex,
      isActive: leaveTypes.isActive,
    })
    .from(leaveTypes)
    .where(includeInactive ? undefined : eq(leaveTypes.isActive, true))
    .orderBy(asc(leaveTypes.colorIndex), asc(leaveTypes.name));
}
