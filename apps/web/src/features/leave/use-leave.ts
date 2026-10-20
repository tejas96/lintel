'use client';

import type { LeaveRequest } from '@lintel/api-contracts';
import type { PillTone, StatusGlyphName } from '@lintel/design-system/web';
import { useToast } from '@lintel/design-system/web';
import type { DayPortion } from '@lintel/domain';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDeferredValue } from 'react';
import { api, expectStatus } from '@/lib/api/api-client';
import { useFailureToast } from '@/lib/query/use-failure-toast';

export const leaveKeys = {
  types: ['leave', 'types'] as const,
  balances: ['leave', 'balances'] as const,
  mine: ['leave', 'requests', 'mine'] as const,
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

export function useLeaveRequest(id: string, enabled: boolean) {
  return useQuery({
    queryKey: leaveKeys.request(id),
    queryFn: () => expectStatus(api.leave.getLeaveRequest({ params: { id } }), 200),
    enabled,
  });
}

/** Cancelling refreshes the list and the balances it frees up. */
export function useCancelLeave() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const fail = useFailureToast();
  return useMutation({
    mutationFn: (input: { id: string; version: number }) =>
      expectStatus(
        api.leave.cancelLeaveRequest({
          params: { id: input.id },
          body: { note: null, version: input.version },
        }),
        200,
      ),
    onSuccess: (request) => {
      queryClient.setQueryData(leaveKeys.request(request.id), request);
      void queryClient.invalidateQueries({ queryKey: ['leave'] });
      toast({ tone: 'success', title: 'Leave cancelled', description: request.durationLabel });
    },
    onError: (error, input) =>
      fail(error, 'cancel the leave', [leaveKeys.request(input.id), leaveKeys.mine]),
  });
}

export interface LeavePeriodInput {
  readonly leaveTypeId: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly dayPortion: DayPortion;
}

/** The server's impact preview for a period, refreshed as the person changes the dates. */
export function useLeavePreview(period: LeavePeriodInput | null, enabled: boolean) {
  const deferred = useDeferredValue(period);
  return useQuery({
    queryKey: ['leave', 'preview', deferred],
    queryFn: () => {
      if (!deferred) throw new Error('Choose the days first.');
      return expectStatus(
        api.leave.previewLeave({ body: { ...deferred, userId: null, reason: null } }),
        200,
      );
    },
    enabled: enabled && deferred !== null,
    placeholderData: keepPreviousData,
  });
}
