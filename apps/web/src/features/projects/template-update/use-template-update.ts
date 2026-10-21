'use client';

import { useToast } from '@lintel/design-system/web';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, expectStatus } from '@/lib/api/api-client';
import { queryKeys } from '@/lib/query/query-keys';
import { useFailureToast } from '@/lib/query/use-failure-toast';

/** Which version the project follows, whether a newer one exists, and past updates. */
export function useTemplateUpdateStatus(projectId: string) {
  return useQuery({
    queryKey: queryKeys.templateUpdate(projectId),
    queryFn: () =>
      expectStatus(api.templateUpdates.getTemplateUpdateStatus({ params: { id: projectId } }), 200),
  });
}

/**
 * The dry run. It is a POST (it takes the ticks) but saves nothing, so it is
 * cached like a query and refetched whenever the ticks change.
 */
export function useTemplateUpdatePreview(
  projectId: string,
  targetVersionId: string | null,
  ticked: readonly string[],
) {
  const sorted = [...ticked].sort();
  return useQuery({
    queryKey: queryKeys.templateUpdatePreview(projectId, targetVersionId ?? 'none', sorted),
    queryFn: () =>
      expectStatus(
        api.templateUpdates.previewTemplateUpdate({
          params: { id: projectId },
          body: { targetVersionId: targetVersionId ?? '', ticked: sorted },
        }),
        200,
      ),
    enabled: targetVersionId !== null,
    placeholderData: keepPreviousData,
  });
}

export function useApplyTemplateUpdate(projectId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const fail = useFailureToast();
  return useMutation({
    mutationFn: (input: {
      targetVersionId: string;
      ticked: string[];
      extendPlannedEnd: boolean;
      version: number;
    }) =>
      expectStatus(
        api.templateUpdates.applyTemplateUpdate({ params: { id: projectId }, body: input }),
        200,
      ),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.allTaskLists });
      void queryClient.invalidateQueries({ queryKey: queryKeys.templateUpdate(projectId) });
      toast({
        tone: 'success',
        title: `Moved to version ${result.toVersionNumber}`,
        description: `${result.added} added, ${result.changed} changed, ${result.cancelled} cancelled. Recorded in the activity and schedule history.`,
      });
    },
    onError: (error) =>
      fail(error, 'apply the update', [
        queryKeys.project(projectId),
        queryKeys.templateUpdate(projectId),
      ]),
  });
}
