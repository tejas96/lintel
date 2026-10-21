'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, expectStatus } from '@/lib/api/api-client';
import { queryKeys } from '@/lib/query/query-keys';

export function useProject(projectId: string) {
  return useQuery({
    queryKey: queryKeys.project(projectId),
    queryFn: () => expectStatus(api.projects.getProject({ params: { id: projectId } }), 200),
  });
}

/** Every task in the project (open and closed), up to the API's page limit. */
export function useProjectTasks(projectId: string) {
  const filters = { projectId, status: 'all', pageSize: 100, sort: 'dueDate' } as const;
  return useQuery({
    queryKey: queryKeys.taskList(filters),
    queryFn: () => expectStatus(api.tasks.listTasks({ query: { ...filters, page: 1 } }), 200),
  });
}

export function useOpenBlockers(projectId: string) {
  return useQuery({
    queryKey: queryKeys.openBlockers(projectId),
    queryFn: () => expectStatus(api.tasks.listOpenBlockers({ query: { projectId } }), 200),
  });
}

export function useProjectActivity(projectId: string, page: number) {
  return useQuery({
    queryKey: queryKeys.projectActivity(projectId, page),
    queryFn: () =>
      expectStatus(
        api.projects.listProjectActivity({
          params: { id: projectId },
          query: { page, pageSize: 30 },
        }),
        200,
      ),
    placeholderData: keepPreviousData,
  });
}

/** Risk cards for the project: what is happening, the slip, the next action, who and when. */
export function useProjectRisks(projectId: string) {
  return useQuery({
    queryKey: queryKeys.projectRisks(projectId),
    queryFn: () => expectStatus(api.insights.projectRisks({ params: { id: projectId } }), 200),
    refetchInterval: 2 * 60_000,
  });
}
