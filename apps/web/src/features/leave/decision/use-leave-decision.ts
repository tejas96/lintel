'use client';

import type { LeaveRequestDetail } from '@lintel/api-contracts';
import { useToast } from '@lintel/design-system/web';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, expectStatus } from '@/lib/api/api-client';
import { queryKeys } from '@/lib/query/query-keys';
import { useFailureToast } from '@/lib/query/use-failure-toast';
import { leaveKeys } from '../use-leave';

export type LeaveDecision = 'approve' | 'reject' | 'request_info';

export interface HandoverProposal {
  readonly taskId: string;
  readonly toUserId: string | null;
  readonly note: string | null;
}

const DECISION_TOASTS: Readonly<Record<LeaveDecision, string>> = {
  approve: 'Leave approved',
  reject: 'Leave rejected',
  request_info: 'Question sent',
};

/** What happened, in words, once the server has applied a decision. */
function decisionDescription(decision: LeaveDecision, request: LeaveRequestDetail): string {
  const next = request.steps.find((step) => step.status === 'pending');
  if (decision === 'approve' && request.status === 'pending' && next) {
    return `${next.approver?.fullName ?? 'The next approver'} decides next.`;
  }
  if (decision === 'request_info') return `${request.user.fullName} has been asked to reply.`;
  return `${request.user.fullName} has been told.`;
}

/**
 * Every change made from the leave decision screen. Each success stores the
 * fresh detail the server returns, so the page never shows a stale version.
 * `onStale` lets the screen show its refresh prompt instead of a toast.
 */
export function useLeaveDecisionMutations(requestId: string, onStale: (error: unknown) => boolean) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const fail = useFailureToast();
  const settle = (request: LeaveRequestDetail) => {
    queryClient.setQueryData(leaveKeys.request(request.id), request);
    void queryClient.invalidateQueries({ queryKey: ['leave', 'requests'] });
    void queryClient.invalidateQueries({ queryKey: ['leave', 'balances'] });
    void queryClient.invalidateQueries({ queryKey: queryKeys.approvals });
  };
  const failure = (action: string) => (error: unknown) => {
    if (onStale(error)) return;
    fail(error, action);
    // A refusal usually means the request moved on (someone else decided); show where it is now.
    void queryClient.invalidateQueries({ queryKey: leaveKeys.request(requestId) });
  };

  const decide = useMutation({
    mutationFn: (input: { decision: LeaveDecision; note: string | null; version: number }) =>
      expectStatus(api.leave.decideLeaveRequest({ params: { id: requestId }, body: input }), 200),
    onSuccess: (request, input) => {
      settle(request);
      toast({
        tone: 'success',
        title: DECISION_TOASTS[input.decision],
        description: decisionDescription(input.decision, request),
      });
    },
    onError: failure('record the decision'),
  });

  const respond = useMutation({
    mutationFn: (input: { reason: string; handovers: HandoverProposal[]; version: number }) =>
      expectStatus(api.leave.respondToInfoRequest({ params: { id: requestId }, body: input }), 200),
    onSuccess: (request) => {
      settle(request);
      toast({
        tone: 'success',
        title: 'Reply sent',
        description: 'Your approver has the details and can decide now.',
      });
    },
    onError: failure('send your reply'),
  });

  const cancel = useMutation({
    mutationFn: (input: { note: string | null; version: number }) =>
      expectStatus(api.leave.cancelLeaveRequest({ params: { id: requestId }, body: input }), 200),
    onSuccess: (request) => {
      settle(request);
      toast({ tone: 'success', title: 'Leave cancelled', description: request.durationLabel });
    },
    onError: failure('cancel the leave'),
  });

  const handover = useMutation({
    mutationFn: (input: {
      handoverId: string;
      decision: 'accept' | 'decline' | 'apply';
      toUserId: string | null;
    }) =>
      expectStatus(
        api.leave.decideHandover({
          params: { id: input.handoverId },
          body: { decision: input.decision, toUserId: input.toUserId },
        }),
        200,
      ),
    onSuccess: (request, input) => {
      settle(request);
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.workQueue });
      const titles = {
        accept: 'Handover accepted',
        decline: 'Handover declined',
        apply: 'Task handed over',
      } as const;
      toast({ tone: 'success', title: titles[input.decision] });
    },
    onError: failure('answer the handover'),
  });

  return { decide, respond, cancel, handover };
}
