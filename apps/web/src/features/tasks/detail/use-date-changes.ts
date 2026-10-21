'use client';

import type { DateChangeRequest } from '@lintel/api-contracts';
import { useToast } from '@lintel/design-system/web';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, expectStatus } from '@/lib/api/api-client';
import { queryKeys } from '@/lib/query/query-keys';
import { useFailureToast } from '@/lib/query/use-failure-toast';

export function useTaskDateChanges(taskId: string) {
  return useQuery({
    queryKey: queryKeys.taskDateChanges(taskId),
    queryFn: () =>
      expectStatus(api.dateChanges.listTaskDateChanges({ params: { id: taskId } }), 200),
  });
}

export interface DateChangeAsk {
  readonly reason: string;
  readonly proposedStartDate: string | null;
  readonly proposedDueDate: string;
}

/** Ask, decide and withdraw. Each refreshes the task (its dates may move), risks and the queue. */
export function useDateChangeMutations(taskId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const fail = useFailureToast();
  const refresh = () => {
    for (const queryKey of [
      queryKeys.taskDateChanges(taskId),
      queryKeys.task(taskId),
      queryKeys.allTaskLists,
      queryKeys.approvals,
      queryKeys.allBriefings,
      ['projects', 'detail'],
    ]) {
      void queryClient.invalidateQueries({ queryKey });
    }
  };
  const ask = useMutation({
    mutationFn: (input: DateChangeAsk) =>
      expectStatus(api.dateChanges.requestDateChange({ params: { id: taskId }, body: input }), 201),
    onSuccess: () => {
      refresh();
      toast({
        tone: 'success',
        title: 'Request sent',
        description: 'The project manager will accept or decline the new date.',
      });
    },
    onError: (error) => fail(error, 'send the request', [queryKeys.taskDateChanges(taskId)]),
  });
  const decide = useMutation({
    mutationFn: (input: {
      request: DateChangeRequest;
      decision: 'accepted' | 'declined';
      note: string | null;
    }) =>
      expectStatus(
        api.dateChanges.decideDateChange({
          params: { id: input.request.id },
          body: { decision: input.decision, note: input.note, version: input.request.version },
        }),
        200,
      ),
    onSuccess: (request) => {
      refresh();
      toast({
        tone: 'success',
        title: request.status === 'accepted' ? 'New date set' : 'Request declined',
        description: `${request.requestedBy.fullName} has been told.`,
      });
    },
    onError: (error) => fail(error, 'record the decision', [queryKeys.taskDateChanges(taskId)]),
  });
  const withdraw = useMutation({
    mutationFn: (request: DateChangeRequest) =>
      expectStatus(
        api.dateChanges.withdrawDateChange({
          params: { id: request.id },
          body: { version: request.version },
        }),
        200,
      ),
    onSuccess: () => {
      refresh();
      toast({ tone: 'success', title: 'Request withdrawn' });
    },
    onError: (error) => fail(error, 'withdraw the request', [queryKeys.taskDateChanges(taskId)]),
  });
  return { ask, decide, withdraw };
}
