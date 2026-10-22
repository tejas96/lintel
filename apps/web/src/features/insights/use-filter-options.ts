'use client';

import type { ProjectSummary, Team, UserSummary } from '@lintel/api-contracts';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useSession } from '@/features/session/session-provider';
import { api, expectStatus } from '@/lib/api/api-client';
import { queryKeys } from '@/lib/query/query-keys';

export interface FilterOptions {
  /** Projects the viewer can filter by: every project for leadership, their own for managers. */
  readonly projects: readonly ProjectSummary[];
  /** People who manage at least one of those projects. */
  readonly managers: readonly UserSummary[];
  readonly teams: readonly Team[];
  /** Leadership sees the studio and may filter by manager; managers see only their projects. */
  readonly business: boolean;
  readonly loading: boolean;
}

const PROJECT_QUERY = {
  page: 1,
  pageSize: 100,
  status: 'all',
  sort: 'name',
  direction: 'asc',
} as const;

/** What the filter controls offer, from the projects and teams the viewer may see. */
export function useFilterOptions(): FilterOptions {
  const { user, can } = useSession();
  const business = can('dashboard.view_business');
  const projects = useQuery({
    queryKey: queryKeys.projectList(PROJECT_QUERY),
    queryFn: () => expectStatus(api.projects.listProjects({ query: PROJECT_QUERY }), 200),
    staleTime: 5 * 60_000,
  });
  const teams = useQuery({
    queryKey: queryKeys.teams,
    queryFn: () => expectStatus(api.teams.listTeams({ query: { status: 'active' } }), 200),
    enabled: can('users.view_directory'),
    staleTime: 5 * 60_000,
  });
  return useMemo(() => {
    const visible = (projects.data?.items ?? []).filter(
      (project) => business || project.manager.id === user.id,
    );
    const managers = new Map<string, UserSummary>();
    for (const project of visible) managers.set(project.manager.id, project.manager);
    return {
      projects: visible,
      managers: [...managers.values()].sort((left, right) =>
        left.fullName.localeCompare(right.fullName),
      ),
      teams: teams.data ?? [],
      business,
      loading: projects.isPending,
    };
  }, [projects.data, projects.isPending, teams.data, business, user.id]);
}
