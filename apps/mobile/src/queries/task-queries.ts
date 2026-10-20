import type { TaskDetail } from '@lintel/api-contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/api/api-client';
import { queryKeys } from '@/api/query-keys';
import { applyTaskChange } from './work-queries';

type TaskStatus = TaskDetail['status'];
type BlockerCategory = TaskDetail['blockers'][number]['category'];

export function useTask(taskId: string) {
  return useQuery({
    queryKey: queryKeys.task(taskId),
    queryFn: ({ signal }) =>
      unwrap(api.tasks.getTask({ params: { id: taskId }, fetchOptions: { signal } })),
  });
}

export function useTaskComments(taskId: string) {
  return useQuery({
    queryKey: queryKeys.taskComments(taskId),
    queryFn: ({ signal }) =>
      unwrap(api.tasks.listComments({ params: { id: taskId }, fetchOptions: { signal } })),
  });
}

/** Status changes use the version the person saw, so a stale screen is refused, not overwritten. */
export function useTransitionTask(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { to: TaskStatus; note: string | null; version: number }) =>
      unwrap(api.tasks.transitionTask({ params: { id: taskId }, body: input })),
    onSuccess: (task) => applyTaskChange(queryClient, task),
  });
}

export function useAcknowledgeTask(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.tasks.acknowledgeTask({ params: { id: taskId }, body: {} })),
    onSuccess: (task) => applyTaskChange(queryClient, task),
  });
}

/** Ticks feel instant: the item flips immediately and rolls back if the server refuses. */
export function useToggleChecklistItem(taskId: string) {
  const queryClient = useQueryClient();
  const key = queryKeys.task(taskId);
  return useMutation({
    mutationFn: (input: { itemId: string; completed: boolean }) =>
      unwrap(
        api.tasks.toggleChecklistItem({
          params: { id: input.itemId },
          body: { completed: input.completed },
        }),
      ),
    onMutate: async ({ itemId, completed }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<TaskDetail>(key);
      if (previous) {
        queryClient.setQueryData<TaskDetail>(key, {
          ...previous,
          checklistItems: previous.checklistItems.map((item) =>
            item.id === itemId
              ? { ...item, completedAt: completed ? new Date().toISOString() : null }
              : item,
          ),
        });
      }
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSuccess: (task) => applyTaskChange(queryClient, task),
  });
}

export function useAddChecklistItem(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (label: string) =>
      unwrap(
        api.tasks.addChecklistItem({ params: { id: taskId }, body: { label, isRequired: false } }),
      ),
    onSuccess: (task) => applyTaskChange(queryClient, task),
  });
}

export function useReportBlocker(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      category: BlockerCategory;
      reason: string;
      waitingOnUserId: string | null;
      version: number;
    }) => unwrap(api.tasks.reportBlocker({ params: { id: taskId }, body: input })),
    onSuccess: (task) => applyTaskChange(queryClient, task),
  });
}

export function useResolveBlocker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { blockerId: string; resolution: string; resumeWork: boolean }) =>
      unwrap(
        api.tasks.resolveBlocker({
          params: { id: input.blockerId },
          body: { resolution: input.resolution, resumeWork: input.resumeWork },
        }),
      ),
    onSuccess: (task) => applyTaskChange(queryClient, task),
  });
}

export function useAddComment(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      unwrap(api.tasks.addComment({ params: { id: taskId }, body: { body } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.taskComments(taskId) }),
  });
}

export function useAttachFileToTask(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fileId: string) =>
      unwrap(api.deliverables.attachFileToTask({ params: { id: taskId }, body: { fileId } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.task(taskId) }),
  });
}
