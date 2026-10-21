'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

/** Filters shared by the command center and the reports. Null = not filtered. */
export interface InsightFilters {
  readonly from: string | null;
  readonly to: string | null;
  readonly projectId: string | null;
  readonly managerUserId: string | null;
  readonly teamId: string | null;
}

export type InsightFilterKey = keyof InsightFilters;

/** Short, readable URL names: ?from=2026-08-01&to=2026-10-21&project=…&manager=…&team=… */
const PARAMS: Readonly<Record<InsightFilterKey, string>> = {
  from: 'from',
  to: 'to',
  projectId: 'project',
  managerUserId: 'manager',
  teamId: 'team',
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function read(params: URLSearchParams, key: InsightFilterKey): string | null {
  const value = params.get(PARAMS[key]);
  if (!value) return null;
  const valid = key === 'from' || key === 'to' ? DATE.test(value) : ID.test(value);
  return valid ? value : null;
}

/** The API query for these filters: only the values that are set. */
export function toInsightQuery(filters: InsightFilters) {
  return {
    ...(filters.from ? { from: filters.from } : {}),
    ...(filters.to ? { to: filters.to } : {}),
    ...(filters.projectId ? { projectId: filters.projectId } : {}),
    ...(filters.managerUserId ? { managerUserId: filters.managerUserId } : {}),
    ...(filters.teamId ? { teamId: filters.teamId } : {}),
  };
}

/** The same filters as a URL query string ("" when none), for links and downloads. */
export function insightSearch(filters: InsightFilters): string {
  const query = new URLSearchParams();
  for (const key of Object.keys(PARAMS) as InsightFilterKey[]) {
    const value = filters[key];
    if (value) query.set(PARAMS[key], value);
  }
  const text = query.toString();
  return text ? `?${text}` : '';
}

/**
 * Filters live in the URL: a filtered view can be bookmarked and shared, and
 * every change is a history entry, so Back undoes the last filter.
 */
export function useInsightFilters() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const filters = useMemo<InsightFilters>(
    () => ({
      from: read(params, 'from'),
      to: read(params, 'to'),
      projectId: read(params, 'projectId'),
      managerUserId: read(params, 'managerUserId'),
      teamId: read(params, 'teamId'),
    }),
    [params],
  );
  const update = useCallback(
    (patch: Partial<InsightFilters>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch) as [InsightFilterKey, string | null][]) {
        if (value) next.set(PARAMS[key], value);
        else next.delete(PARAMS[key]);
      }
      const search = next.toString();
      router.push(search ? `${pathname}?${search}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );
  const clear = useCallback(
    () => update({ from: null, to: null, projectId: null, managerUserId: null, teamId: null }),
    [update],
  );
  const active =
    Number(Boolean(filters.from || filters.to)) +
    Number(Boolean(filters.projectId)) +
    Number(Boolean(filters.managerUserId)) +
    Number(Boolean(filters.teamId));
  return { filters, update, clear, active, query: toInsightQuery(filters) };
}
