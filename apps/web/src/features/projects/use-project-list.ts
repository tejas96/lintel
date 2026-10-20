'use client';

import {
  PROJECT_STATUSES,
  PROJECT_TYPES,
  type ProjectStatus,
  type ProjectType,
} from '@lintel/domain';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { api, expectStatus } from '@/lib/api/api-client';
import { queryKeys } from '@/lib/query/query-keys';

const HEALTH_VALUES = ['not_started', 'on_track', 'at_risk', 'off_track', 'closed'] as const;
const SORTS = ['plannedEndDate', 'name', 'health', 'createdAt'] as const;

export type HealthFilter = (typeof HEALTH_VALUES)[number] | 'any';
export type StatusFilter = ProjectStatus | 'open' | 'all';
export type SortKey = (typeof SORTS)[number];

export interface ProjectFilters {
  readonly search: string;
  readonly status: StatusFilter;
  readonly health: HealthFilter;
  readonly projectType: ProjectType | 'any';
  readonly sort: SortKey;
  readonly view: 'cards' | 'table';
  readonly page: number;
}

function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.find((candidate) => candidate === value) ?? fallback;
}

/** Filters live in the URL, so a filtered list can be bookmarked and shared. */
export function useProjectFilters(): [ProjectFilters, (patch: Partial<ProjectFilters>) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const filters = useMemo<ProjectFilters>(
    () => ({
      search: params.get('q') ?? '',
      status: pick<StatusFilter>(
        params.get('status'),
        ['open', 'all', ...PROJECT_STATUSES],
        'open',
      ),
      health: pick<HealthFilter>(params.get('health'), ['any', ...HEALTH_VALUES], 'any'),
      projectType: pick<ProjectType | 'any'>(params.get('type'), ['any', ...PROJECT_TYPES], 'any'),
      sort: pick<SortKey>(params.get('sort'), SORTS, 'plannedEndDate'),
      view: params.get('view') === 'table' ? 'table' : 'cards',
      page: Math.max(1, Number(params.get('page')) || 1),
    }),
    [params],
  );
  const update = useCallback(
    (patch: Partial<ProjectFilters>) => {
      const next = { ...filters, page: 1, ...patch };
      const query = new URLSearchParams();
      if (next.search) query.set('q', next.search);
      if (next.status !== 'open') query.set('status', next.status);
      if (next.health !== 'any') query.set('health', next.health);
      if (next.projectType !== 'any') query.set('type', next.projectType);
      if (next.sort !== 'plannedEndDate') query.set('sort', next.sort);
      if (next.view !== 'cards') query.set('view', next.view);
      if (next.page > 1) query.set('page', String(next.page));
      const suffix = query.toString();
      router.replace(suffix ? `${pathname}?${suffix}` : pathname, { scroll: false });
    },
    [filters, pathname, router],
  );
  return [filters, update];
}

export const PROJECTS_PAGE_SIZE = 24;

export function useProjectList(filters: ProjectFilters) {
  const query = {
    page: filters.page,
    pageSize: PROJECTS_PAGE_SIZE,
    status: filters.status,
    sort: filters.sort,
    direction: filters.sort === 'createdAt' ? ('desc' as const) : ('asc' as const),
    ...(filters.search ? { search: filters.search } : {}),
    ...(filters.health !== 'any' ? { health: filters.health } : {}),
    ...(filters.projectType !== 'any' ? { projectType: filters.projectType } : {}),
  };
  return useQuery({
    queryKey: queryKeys.projectList(query),
    queryFn: () => expectStatus(api.projects.listProjects({ query }), 200),
    placeholderData: keepPreviousData,
  });
}
