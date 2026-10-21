'use client';

import { useToast } from '@lintel/design-system/web';
import type { TaskPriority } from '@lintel/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, expectStatus } from '@/lib/api/api-client';
import { queryKeys } from '@/lib/query/query-keys';
import { useFailureToast } from '@/lib/query/use-failure-toast';

export type TaskShift = { readonly taskId: string; readonly shiftWorkingDays: number };

export interface ScopeRequest {
  readonly taskShifts: TaskShift[];
  readonly newTasks: {
    title: string;
    stageId: string | null;
    plannedStartDate: string | null;
    dueDate: string | null;
    ownerUserId: string | null;
    priority: TaskPriority;
  }[];
  readonly cancelTaskIds: string[];
}

export function useScopeChanges(projectId: string) {
  return useQuery({
    queryKey: queryKeys.scopeChanges(projectId),
    queryFn: () => expectStatus(api.projects.listScopeChanges({ params: { id: projectId } }), 200),
  });
}

/** Preview (no save), propose and decide. Decisions refresh the project's dates. */
export function useScopeChangeMutations(projectId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const fail = useFailureToast();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.scopeChanges(projectId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.allTaskLists });
    void queryClient.invalidateQueries({ queryKey: queryKeys.approvals });
  };
  const preview = useMutation({
    mutationFn: (request: ScopeRequest) =>
      expectStatus(
        api.projects.previewScopeChange({ params: { id: projectId }, body: request }),
        200,
      ),
    onError: (error) => fail(error, 'preview the change'),
  });
  const propose = useMutation({
    mutationFn: (input: ScopeRequest & { title: string; description: string }) =>
      expectStatus(
        api.projects.proposeScopeChange({ params: { id: projectId }, body: input }),
        201,
      ),
    onSuccess: (change) => {
      refresh();
      toast({ tone: 'success', title: 'Scope change proposed', description: change.title });
    },
    onError: (error) => fail(error, 'propose the change'),
  });
  const decide = useMutation({
    mutationFn: (input: {
      id: string;
      decision: 'approved' | 'rejected';
      note: string;
      version: number;
    }) =>
      expectStatus(
        api.projects.decideScopeChange({
          params: { id: input.id },
          body: { decision: input.decision, note: input.note, version: input.version },
        }),
        200,
      ),
    onSuccess: (change) => {
      refresh();
      toast({
        tone: 'success',
        title: change.status === 'approved' ? 'Change approved; dates updated' : 'Change rejected',
        description: change.title,
      });
    },
    onError: (error) => fail(error, 'record the decision', [queryKeys.scopeChanges(projectId)]),
  });
  return { preview, propose, decide };
}
