'use client';

import { useToast } from '@lintel/design-system/web';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, expectStatus } from '@/lib/api/api-client';
import { queryKeys } from '@/lib/query/query-keys';

export interface DateChange {
  readonly taskId: string;
  readonly plannedStartDate: string;
  readonly dueDate: string;
}

/**
 * Timeline rescheduling: preview what a change moves, apply it, or — when it
 * would move the agreed end date — propose it as a scope change instead.
 */
export function useReschedule(projectId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.allTaskLists });
    void queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.scopeChanges(projectId) });
    void queryClient.invalidateQueries({ queryKey: ['tasks', 'detail'] });
  };
  const preview = useMutation({
    mutationFn: (change: DateChange) =>
      expectStatus(
        api.planning.previewReschedule({ params: { id: projectId }, body: { changes: [change] } }),
        200,
      ),
  });
  const apply = useMutation({
    mutationFn: (input: { change: DateChange; reason: string | null; version: number }) =>
      expectStatus(
        api.planning.rescheduleTasks({
          params: { id: projectId },
          body: {
            changes: [input.change],
            reason: input.reason,
            expectedVersions: [{ taskId: input.change.taskId, version: input.version }],
          },
        }),
        200,
      ),
    onSuccess: async (result) => {
      refresh();
      toast({
        tone: 'success',
        title: result.moved === 1 ? 'Task rescheduled' : `${result.moved} tasks rescheduled`,
        description: 'The new dates are saved and the owners are told.',
      });
    },
  });
  const propose = useMutation({
    mutationFn: (input: { change: DateChange; title: string; description: string }) =>
      expectStatus(
        api.projects.proposeScopeChange({
          params: { id: projectId },
          body: {
            title: input.title,
            description: input.description,
            taskShifts: [],
            taskDateChanges: [input.change],
            newTasks: [],
            cancelTaskIds: [],
          },
        }),
        201,
      ),
    onSuccess: (change) => {
      refresh();
      toast({
        tone: 'success',
        title: 'Scope change proposed',
        description: `${change.title}. The dates move once it is approved.`,
      });
    },
  });
  return { preview, apply, propose };
}
