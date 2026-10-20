import type { TaskDetail } from '@lintel/api-contracts';
import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/api/api-client';
import { queryKeys } from '@/api/query-keys';

/** The server's prioritised day: buckets, headline and reasons come from the API. */
export function useWorkQueue() {
  return useQuery({
    queryKey: queryKeys.workQueue,
    queryFn: ({ signal }) => unwrap(api.work.myWorkQueue({ fetchOptions: { signal } })),
    refetchInterval: 5 * 60_000,
  });
}

/** After any change to a task, the detail is replaced and the lists that show it refresh. */
export function applyTaskChange(queryClient: QueryClient, task: TaskDetail): void {
  queryClient.setQueryData(queryKeys.task(task.id), task);
  void queryClient.invalidateQueries({ queryKey: queryKeys.workQueue });
  void queryClient.invalidateQueries({ queryKey: queryKeys.approvals });
  void queryClient.invalidateQueries({ queryKey: queryKeys.project(task.project.id) });
}

export function useStartWork() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) =>
      unwrap(api.work.startWork({ params: { id: taskId }, body: {} })),
    onSuccess: (task) => {
      applyTaskChange(queryClient, task);
      // One active session per person: starting here may have paused another task.
      void queryClient.invalidateQueries({
        queryKey: queryKeys.tasks,
        predicate: (query) => query.queryKey[1] !== task.id,
      });
    },
  });
}

export function usePauseWork() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) =>
      unwrap(api.work.pauseWork({ params: { id: taskId }, body: {} })),
    onSuccess: (task) => applyTaskChange(queryClient, task),
  });
}
