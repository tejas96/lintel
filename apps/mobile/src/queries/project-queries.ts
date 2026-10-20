import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/api/api-client';
import { queryKeys } from '@/api/query-keys';

const PAGE_SIZE = 20;

export function useProjects(search: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.projects(search),
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      unwrap(
        api.projects.listProjects({
          query: {
            page: pageParam,
            pageSize: PAGE_SIZE,
            status: 'open',
            sort: 'plannedEndDate',
            direction: 'asc',
            ...(search ? { search } : {}),
          },
          fetchOptions: { signal },
        }),
      ),
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });
}

export function useProject(projectId: string) {
  return useQuery({
    queryKey: queryKeys.project(projectId),
    queryFn: ({ signal }) =>
      unwrap(api.projects.getProject({ params: { id: projectId }, fetchOptions: { signal } })),
  });
}

export function useProjectDeliverables(projectId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.projectDeliverables(projectId),
    queryFn: ({ signal }) =>
      unwrap(
        api.deliverables.listProjectDeliverables({
          params: { id: projectId },
          fetchOptions: { signal },
        }),
      ),
    enabled,
  });
}

export function useSiteUpdates(projectId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.siteUpdates(projectId),
    queryFn: ({ signal }) =>
      unwrap(
        api.deliverables.listSiteUpdates({ params: { id: projectId }, fetchOptions: { signal } }),
      ),
    enabled,
  });
}

export function useCreateSiteUpdate(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      taskId: string | null;
      note: string;
      hasIssue: boolean;
      photoFileIds: string[];
    }) => unwrap(api.deliverables.createSiteUpdate({ params: { id: projectId }, body: input })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.siteUpdates(projectId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
    },
  });
}
