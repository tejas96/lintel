'use client';

import type { TaskSummary } from '@lintel/api-contracts';
import { useToast } from '@lintel/design-system/web';
import { TASK_TRANSITIONS, type TaskStatus } from '@lintel/domain';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, expectStatus } from '@/lib/api/api-client';
import { queryKeys } from '@/lib/query/query-keys';
import { useFailureToast } from '@/lib/query/use-failure-toast';

type TaskPage = {
  items: TaskSummary[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

/** Moves the domain allows from a status. The server still checks the business rules. */
export function legalTargets(status: TaskStatus): readonly TaskStatus[] {
  return TASK_TRANSITIONS[status];
}

/**
 * Moves a card to another column: shown at once, confirmed by the server,
 * and put back with the server's reason if it refuses.
 */
export function useBoardMove(projectId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const fail = useFailureToast();
  const listKey = queryKeys.taskList({ projectId, status: 'all', pageSize: 100, sort: 'dueDate' });
  return useMutation({
    mutationFn: (input: { task: TaskSummary; to: TaskStatus }) =>
      expectStatus(
        api.tasks.transitionTask({
          params: { id: input.task.id },
          body: { to: input.to, note: null, version: input.task.version },
        }),
        200,
      ),
    onMutate: async ({ task, to }) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<TaskPage>(listKey);
      if (previous) {
        queryClient.setQueryData<TaskPage>(listKey, {
          ...previous,
          items: previous.items.map((item) =>
            item.id === task.id ? { ...item, status: to } : item,
          ),
        });
      }
      return { previous };
    },
    onError: (error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(listKey, context.previous);
      fail(error, 'move the task', [listKey]);
    },
    onSuccess: (detail) => {
      queryClient.setQueryData(queryKeys.task(detail.id), detail);
      toast({ tone: 'success', title: 'Task moved', description: detail.title });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: listKey });
      void queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.workQueue });
    },
  });
}
