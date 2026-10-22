import type { DateChangeRequest } from '@lintel/api-contracts';
import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/api/api-client';
import { queryKeys } from '@/api/query-keys';

/** New-date requests on a task, and whether the viewer may ask, decide or withdraw. */
export function useTaskDateChanges(taskId: string) {
  return useQuery({
    queryKey: queryKeys.taskDateChanges(taskId),
    queryFn: ({ signal }) =>
      unwrap(
        api.dateChanges.listTaskDateChanges({ params: { id: taskId }, fetchOptions: { signal } }),
      ),
  });
}

/** What accepting a request would do to the rest of the plan (for people who decide). */
export function useDateChangeImpact(request: DateChangeRequest) {
  return useQuery({
    queryKey: queryKeys.dateChangeImpact(request.task.id, request.id),
    queryFn: ({ signal }) =>
      unwrap(
        api.dateChanges.getDateChangeImpact({
          params: { id: request.id },
          fetchOptions: { signal },
        }),
      ),
  });
}

/**
 * Asking, deciding and withdrawing can move the task's dates, so the task
 * (and its requests, under the same key), the queue and approvals refresh.
 */
function refreshAfterDateChange(queryClient: QueryClient, request: DateChangeRequest): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.task(request.task.id) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.workQueue });
  void queryClient.invalidateQueries({ queryKey: queryKeys.approvals });
  void queryClient.invalidateQueries({ queryKey: queryKeys.project(request.project.id) });
}

export interface DateChangeAsk {
  readonly reason: string;
  readonly proposedStartDate: string | null;
  readonly proposedDueDate: string;
}

/** The owner or a collaborator asks the project manager for new dates, with a reason. */
export function useAskDateChange(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DateChangeAsk) =>
      unwrap(api.dateChanges.requestDateChange({ params: { id: taskId }, body: input })),
    onSuccess: (request) => refreshAfterDateChange(queryClient, request),
  });
}

/** The project manager accepts (the task moves) or declines with a note. */
export function useDecideDateChange() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      readonly request: DateChangeRequest;
      readonly decision: 'accepted' | 'declined';
      readonly note: string | null;
      readonly moveWaitingTasks?: boolean;
    }) =>
      unwrap(
        api.dateChanges.decideDateChange({
          params: { id: input.request.id },
          body: {
            decision: input.decision,
            note: input.note,
            version: input.request.version,
            moveWaitingTasks: input.moveWaitingTasks === true,
          },
        }),
      ),
    onSuccess: (request) => refreshAfterDateChange(queryClient, request),
  });
}

/** The requester takes back an open request. */
export function useWithdrawDateChange() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: DateChangeRequest) =>
      unwrap(
        api.dateChanges.withdrawDateChange({
          params: { id: request.id },
          body: { version: request.version },
        }),
      ),
    onSuccess: (request) => refreshAfterDateChange(queryClient, request),
  });
}
