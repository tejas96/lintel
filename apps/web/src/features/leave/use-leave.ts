'use client';

import type { LeaveRequest } from '@lintel/api-contracts';
import type { PillTone, StatusGlyphName } from '@lintel/design-system/web';
import type { DayPortion } from '@lintel/domain';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useDeferredValue } from 'react';
import { api, expectStatus } from '@/lib/api/api-client';
import { formatCalendarDate } from '@/lib/format/dates';

export const leaveKeys = {
  types: ['leave', 'types'] as const,
  balances: ['leave', 'balances'] as const,
  mine: ['leave', 'requests', 'mine'] as const,
  list: (scope: 'to_decide' | 'team') => ['leave', 'requests', scope] as const,
  request: (id: string) => ['leave', 'request', id] as const,
};

export const LEAVE_STATUS: Readonly<
  Record<LeaveRequest['status'], { tone: PillTone; glyph: StatusGlyphName; label: string }>
> = {
  pending: { tone: 'review', glyph: 'review', label: 'Waiting for approval' },
  info_requested: { tone: 'atRisk', glyph: 'changes', label: 'More information needed' },
  approved: { tone: 'onTrack', glyph: 'done', label: 'Approved' },
  rejected: { tone: 'overdue', glyph: 'offTrack', label: 'Not approved' },
  cancelled: { tone: 'neutral', glyph: 'cancelled', label: 'Cancelled' },
};

/** "26 Oct" for one day, "26 Oct to 28 Oct" for a range. */
export function formatLeaveDates(startDate: string, endDate: string, today: string): string {
  return startDate === endDate
    ? formatCalendarDate(startDate, today)
    : `${formatCalendarDate(startDate, today)} to ${formatCalendarDate(endDate, today)}`;
}

/** Half-day units as days: 3 → "1.5 days". */
export function formatHalfDays(units: number): string {
  const days = units / 2;
  return `${Number.isInteger(days) ? days : days.toFixed(1)} ${days === 1 ? 'day' : 'days'}`;
}

export function useLeaveTypes() {
  return useQuery({
    queryKey: leaveKeys.types,
    queryFn: () => expectStatus(api.leave.listLeaveTypes(), 200),
    staleTime: 10 * 60_000,
  });
}

export function useLeaveBalances() {
  return useQuery({
    queryKey: leaveKeys.balances,
    queryFn: () => expectStatus(api.leave.myLeaveBalances(), 200),
  });
}

export function useMyLeaveRequests() {
  return useQuery({
    queryKey: leaveKeys.mine,
    queryFn: () =>
      expectStatus(
        api.leave.listLeaveRequests({
          query: { page: 1, pageSize: 50, scope: 'mine', status: 'all' },
        }),
        200,
      ),
  });
}

/** Requests waiting for my decision, or my team's leave (open first). */
export function useLeaveList(scope: 'to_decide' | 'team', enabled: boolean) {
  return useQuery({
    queryKey: leaveKeys.list(scope),
    queryFn: () =>
      expectStatus(
        api.leave.listLeaveRequests({
          query: { page: 1, pageSize: 50, scope, status: scope === 'to_decide' ? 'open' : 'all' },
        }),
        200,
      ),
    enabled,
  });
}

export function useLeaveRequest(id: string, enabled: boolean) {
  return useQuery({
    queryKey: leaveKeys.request(id),
    queryFn: () => expectStatus(api.leave.getLeaveRequest({ params: { id } }), 200),
    enabled,
  });
}

export interface LeavePeriodInput {
  readonly leaveTypeId: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly dayPortion: DayPortion;
}

/**
 * The server's impact preview for a period, refreshed as the dates change.
 * `userId` previews someone else's absence (managers recording one).
 */
export function useLeavePreview(
  period: LeavePeriodInput | null,
  enabled: boolean,
  userId: string | null = null,
) {
  const deferred = useDeferredValue(period);
  return useQuery({
    queryKey: ['leave', 'preview', userId, deferred],
    queryFn: () => {
      if (!deferred) throw new Error('Choose the days first.');
      return expectStatus(
        api.leave.previewLeave({ body: { ...deferred, userId, reason: null } }),
        200,
      );
    },
    enabled: enabled && deferred !== null,
    placeholderData: keepPreviousData,
  });
}
