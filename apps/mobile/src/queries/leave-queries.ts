import type { LeaveRequestDetail } from '@lintel/api-contracts';
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api, unwrap } from '@/api/api-client';
import { queryKeys } from '@/api/query-keys';

type DayPortion = LeaveRequestDetail['dayPortion'];
export type LeaveScope = 'mine' | 'to_decide';

export interface LeavePeriodInput {
  readonly leaveTypeId: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly dayPortion: DayPortion;
  readonly reason: string | null;
}

export interface HandoverInput {
  readonly taskId: string;
  readonly toUserId: string | null;
  readonly note: string | null;
}

export function useLeaveTypes() {
  return useQuery({
    queryKey: queryKeys.leaveTypes,
    queryFn: ({ signal }) => unwrap(api.leave.listLeaveTypes({ fetchOptions: { signal } })),
    staleTime: 10 * 60_000,
  });
}

export function useLeaveBalances() {
  return useQuery({
    queryKey: queryKeys.leaveBalances,
    queryFn: ({ signal }) => unwrap(api.leave.myLeaveBalances({ fetchOptions: { signal } })),
  });
}

export function useLeaveRequests(scope: LeaveScope) {
  return useInfiniteQuery({
    queryKey: queryKeys.leaveRequests(scope),
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      unwrap(
        api.leave.listLeaveRequests({
          query: {
            page: pageParam,
            pageSize: 20,
            scope,
            status: scope === 'mine' ? 'all' : 'open',
          },
          fetchOptions: { signal },
        }),
      ),
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });
}

export function useLeaveRequest(requestId: string) {
  return useQuery({
    queryKey: queryKeys.leaveRequest(requestId),
    queryFn: ({ signal }) =>
      unwrap(api.leave.getLeaveRequest({ params: { id: requestId }, fetchOptions: { signal } })),
  });
}

/** Live impact: the server works out days, conflicts, overlaps and policy warnings. */
export function useLeavePreview(period: LeavePeriodInput | null) {
  return useQuery({
    queryKey: queryKeys.leavePreview(JSON.stringify(period)),
    queryFn: ({ signal }) => {
      if (!period) throw new Error('No period selected.');
      return unwrap(
        api.leave.previewLeave({ body: { ...period, userId: null }, fetchOptions: { signal } }),
      );
    },
    enabled: period !== null,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    retry: false,
  });
}

function useApplyLeaveChange() {
  const queryClient = useQueryClient();
  return (request: LeaveRequestDetail) => {
    queryClient.setQueryData(queryKeys.leaveRequest(request.id), request);
    void queryClient.invalidateQueries({ queryKey: queryKeys.leaveRequestLists });
    void queryClient.invalidateQueries({ queryKey: queryKeys.leaveBalances });
    void queryClient.invalidateQueries({ queryKey: queryKeys.approvals });
    // Applied handovers change task owners; approved leave changes today's capacity.
    void queryClient.invalidateQueries({ queryKey: queryKeys.workQueue });
    void queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
  };
}

export function useRequestLeave() {
  const apply = useApplyLeaveChange();
  return useMutation({
    mutationFn: (input: LeavePeriodInput & { handovers: HandoverInput[] }) =>
      unwrap(api.leave.requestLeave({ body: input })),
    onSuccess: apply,
  });
}

export function useDecideLeave(requestId: string) {
  const apply = useApplyLeaveChange();
  return useMutation({
    mutationFn: (input: {
      decision: 'approve' | 'reject' | 'request_info';
      note: string | null;
      version: number;
    }) => unwrap(api.leave.decideLeaveRequest({ params: { id: requestId }, body: input })),
    onSuccess: apply,
  });
}

export function useCancelLeave(requestId: string) {
  const apply = useApplyLeaveChange();
  return useMutation({
    mutationFn: (input: { note: string | null; version: number }) =>
      unwrap(api.leave.cancelLeaveRequest({ params: { id: requestId }, body: input })),
    onSuccess: apply,
  });
}

export function useRespondToLeaveInfoRequest(requestId: string) {
  const apply = useApplyLeaveChange();
  return useMutation({
    mutationFn: (input: { reason: string; handovers: HandoverInput[]; version: number }) =>
      unwrap(api.leave.respondToInfoRequest({ params: { id: requestId }, body: input })),
    onSuccess: apply,
  });
}

export function useDecideHandover() {
  const apply = useApplyLeaveChange();
  return useMutation({
    mutationFn: (input: { handoverId: string; decision: 'accept' | 'decline' | 'apply' }) =>
      unwrap(
        api.leave.decideHandover({
          params: { id: input.handoverId },
          body: { decision: input.decision, toUserId: null },
        }),
      ),
    onSuccess: apply,
  });
}
