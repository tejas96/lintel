'use client';

import type { TaskDetail } from '@lintel/api-contracts';
import { useToast } from '@lintel/design-system/web';
import type { TaskStatus } from '@lintel/domain';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, expectStatus } from '@/lib/api/api-client';
import { queryKeys } from '@/lib/query/query-keys';
import { useFailureToast } from '@/lib/query/use-failure-toast';

export interface TransitionInput {
  readonly taskId: string;
  readonly to: TaskStatus;
  readonly note: string | null;
  readonly version: number;
}

export interface BlockerInput {
  readonly taskId: string;
  readonly category:
    | 'client'
    | 'supplier'
    | 'internal_dependency'
    | 'manager_decision'
    | 'information'
    | 'other';
  readonly reason: string;
  readonly waitingOnUserId: string | null;
  readonly version: number;
}

/**
 * Status, work-session and blocker changes for a task. Every success stores
 * the server's fresh task and refreshes the lists that show it; nothing is
 * changed on screen before the server agrees (these rules live server-side).
 */
export function useTaskActions() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const fail = useFailureToast();

  const settle = (detail: TaskDetail, message?: string) => {
    queryClient.setQueryData(queryKeys.task(detail.id), detail);
    void queryClient.invalidateQueries({ queryKey: queryKeys.workQueue });
    void queryClient.invalidateQueries({ queryKey: queryKeys.approvals });
    void queryClient.invalidateQueries({ queryKey: queryKeys.allTaskLists });
    void queryClient.invalidateQueries({ queryKey: queryKeys.project(detail.project.id) });
    if (message) toast({ tone: 'success', title: message, description: detail.title });
  };
  const refreshKeys = (taskId: string) => [queryKeys.task(taskId), queryKeys.workQueue];

  const startWork = useMutation({
    mutationFn: (taskId: string) =>
      expectStatus(api.work.startWork({ params: { id: taskId }, body: {} }), 200),
    onSuccess: (detail) => settle(detail, 'Work started'),
    onError: (error, taskId) => fail(error, 'start work', refreshKeys(taskId)),
  });
  const pauseWork = useMutation({
    mutationFn: (taskId: string) =>
      expectStatus(api.work.pauseWork({ params: { id: taskId }, body: {} }), 200),
    onSuccess: (detail) => settle(detail, 'Work paused'),
    onError: (error, taskId) => fail(error, 'pause work', refreshKeys(taskId)),
  });
  const transition = useMutation({
    mutationFn: ({ taskId, to, note, version }: TransitionInput) =>
      expectStatus(
        api.tasks.transitionTask({ params: { id: taskId }, body: { to, note, version } }),
        200,
      ),
    onSuccess: (detail) => settle(detail, TRANSITION_MESSAGES[detail.status]),
    onError: (error, input) => fail(error, 'change the status', refreshKeys(input.taskId)),
  });
  const acknowledge = useMutation({
    mutationFn: (taskId: string) =>
      expectStatus(api.tasks.acknowledgeTask({ params: { id: taskId }, body: {} }), 200),
    onSuccess: (detail) => settle(detail, 'Acknowledged'),
    onError: (error, taskId) => fail(error, 'acknowledge the task', refreshKeys(taskId)),
  });
  const reportBlocker = useMutation({
    mutationFn: ({ taskId, ...body }: BlockerInput) =>
      expectStatus(api.tasks.reportBlocker({ params: { id: taskId }, body }), 200),
    onSuccess: (detail) => settle(detail, 'Blocker reported. Your manager has been told.'),
    onError: (error, input) => fail(error, 'report the blocker', refreshKeys(input.taskId)),
  });
  const resolveBlocker = useMutation({
    mutationFn: (input: { blockerId: string; resolution: string; resumeWork: boolean }) =>
      expectStatus(
        api.tasks.resolveBlocker({
          params: { id: input.blockerId },
          body: { resolution: input.resolution, resumeWork: input.resumeWork },
        }),
        200,
      ),
    onSuccess: (detail) => settle(detail, 'Blocker resolved'),
    onError: (error) => fail(error, 'resolve the blocker', [queryKeys.workQueue]),
  });

  return { startWork, pauseWork, transition, acknowledge, reportBlocker, resolveBlocker };
}

const TRANSITION_MESSAGES: Readonly<Record<TaskStatus, string>> = {
  draft: 'Moved back to draft',
  ready: 'Marked ready',
  in_progress: 'Back in progress',
  blocked: 'Marked blocked',
  in_review: 'Sent for review',
  changes_requested: 'Changes requested',
  done: 'Marked done',
  cancelled: 'Task cancelled',
};
