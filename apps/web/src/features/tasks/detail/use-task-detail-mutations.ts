'use client';

import type { TaskComment, TaskDetail } from '@lintel/api-contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/features/session/session-provider';
import { api, expectStatus } from '@/lib/api/api-client';
import { queryKeys } from '@/lib/query/query-keys';
import { useFailureToast } from '@/lib/query/use-failure-toast';

/** Checklist and comment changes. Ticks and new comments show at once and roll back on failure. */
export function useTaskDetailMutations(taskId: string) {
  const queryClient = useQueryClient();
  const fail = useFailureToast();
  const { user } = useSession();
  const taskKey = queryKeys.task(taskId);
  const commentsKey = queryKeys.taskComments(taskId);
  const store = (detail: TaskDetail) => {
    queryClient.setQueryData(taskKey, detail);
    void queryClient.invalidateQueries({ queryKey: queryKeys.workQueue });
  };

  const toggleItem = useMutation({
    mutationFn: (input: { itemId: string; completed: boolean }) =>
      expectStatus(
        api.tasks.toggleChecklistItem({
          params: { id: input.itemId },
          body: { completed: input.completed },
        }),
        200,
      ),
    onMutate: async ({ itemId, completed }) => {
      await queryClient.cancelQueries({ queryKey: taskKey });
      const previous = queryClient.getQueryData<TaskDetail>(taskKey);
      if (previous) {
        queryClient.setQueryData<TaskDetail>(taskKey, {
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
    onError: (error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(taskKey, context.previous);
      fail(error, 'update the checklist', [taskKey]);
    },
    onSuccess: store,
  });

  const addItem = useMutation({
    mutationFn: (input: { label: string; isRequired: boolean }) =>
      expectStatus(api.tasks.addChecklistItem({ params: { id: taskId }, body: input }), 200),
    onSuccess: store,
    onError: (error) => fail(error, 'add the item', [taskKey]),
  });

  const removeItem = useMutation({
    mutationFn: (itemId: string) =>
      expectStatus(api.tasks.removeChecklistItem({ params: { id: itemId } }), 200),
    onSuccess: store,
    onError: (error) => fail(error, 'remove the item', [taskKey]),
  });

  const addComment = useMutation({
    mutationFn: (body: string) =>
      expectStatus(api.tasks.addComment({ params: { id: taskId }, body: { body } }), 201),
    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: commentsKey });
      const previous = queryClient.getQueryData<TaskComment[]>(commentsKey) ?? [];
      const pending: TaskComment = {
        id: `pending-${Date.now()}`,
        author: {
          id: user.id,
          fullName: user.fullName,
          designation: user.designation,
          role: user.role,
          avatarHue: user.avatarHue,
          status: user.status,
        },
        body,
        createdAt: new Date().toISOString(),
        editedAt: null,
      };
      queryClient.setQueryData<TaskComment[]>(commentsKey, [...previous, pending]);
      return { previous };
    },
    onError: (error, _body, context) => {
      if (context) queryClient.setQueryData(commentsKey, context.previous);
      fail(error, 'post the comment', [commentsKey]);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: commentsKey }),
  });

  return { toggleItem, addItem, removeItem, addComment };
}
