'use client';

import type { ReassignmentRequest } from '@lintel/api-contracts';
import { useToast } from '@lintel/design-system/web';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, expectStatus } from '@/lib/api/api-client';
import { queryKeys } from '@/lib/query/query-keys';
import { useFailureToast } from '@/lib/query/use-failure-toast';

export function useTaskReassignments(taskId: string) {
  return useQuery({
    queryKey: queryKeys.taskReassignments(taskId),
    queryFn: () =>
      expectStatus(api.reassignments.listTaskReassignments({ params: { id: taskId } }), 200),
  });
}

/** Ask, decide and withdraw. Each refreshes the task (its owner may change) and the queue. */
export function useReassignmentMutations(taskId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const fail = useFailureToast();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.taskReassignments(taskId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.task(taskId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.allTaskLists });
    void queryClient.invalidateQueries({ queryKey: queryKeys.approvals });
  };
  const ask = useMutation({
    mutationFn: (input: { reason: string; suggestedUserId: string | null }) =>
      expectStatus(
        api.reassignments.requestReassignment({ params: { id: taskId }, body: input }),
        201,
      ),
    onSuccess: () => {
      refresh();
      toast({
        tone: 'success',
        title: 'Request sent',
        description: 'The project manager will decide who takes the task.',
      });
    },
    onError: (error) => fail(error, 'send the request', [queryKeys.taskReassignments(taskId)]),
  });
  const decide = useMutation({
    mutationFn: (input: {
      request: ReassignmentRequest;
      decision: 'accepted' | 'declined';
      newOwnerUserId: string | null;
      note: string | null;
    }) =>
      expectStatus(
        api.reassignments.decideReassignment({
          params: { id: input.request.id },
          body: {
            decision: input.decision,
            newOwnerUserId: input.newOwnerUserId,
            note: input.note,
            version: input.request.version,
          },
        }),
        200,
      ),
    onSuccess: (request) => {
      refresh();
      toast({
        tone: 'success',
        title: request.status === 'accepted' ? 'Task reassigned' : 'Request declined',
        description:
          request.status === 'accepted' && request.newOwner
            ? `${request.newOwner.fullName} now owns it.`
            : `${request.requestedBy.fullName} has been told.`,
      });
    },
    onError: (error) => fail(error, 'record the decision', [queryKeys.taskReassignments(taskId)]),
  });
  const withdraw = useMutation({
    mutationFn: (request: ReassignmentRequest) =>
      expectStatus(
        api.reassignments.withdrawReassignment({
          params: { id: request.id },
          body: { version: request.version },
        }),
        200,
      ),
    onSuccess: () => {
      refresh();
      toast({ tone: 'success', title: 'Request withdrawn' });
    },
    onError: (error) => fail(error, 'withdraw the request', [queryKeys.taskReassignments(taskId)]),
  });
  return { ask, decide, withdraw };
}
