'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useInsightFilters } from '@/features/insights/use-insight-filters';
import { api, expectStatus } from '@/lib/api/api-client';
import { queryKeys } from '@/lib/query/query-keys';

/**
 * The reports that learn from history read the same URL filters as the
 * others, and keep the previous result on screen (dimmed) while a new one loads.
 */
const options = { placeholderData: keepPreviousData, staleTime: 60_000 } as const;

export function useEstimatesReport() {
  const { query } = useInsightFilters();
  return useQuery({
    queryKey: queryKeys.report('estimates', query),
    queryFn: () => expectStatus(api.reports.estimatesReport({ query }), 200),
    ...options,
  });
}

export function useReworkReport() {
  const { query } = useInsightFilters();
  return useQuery({
    queryKey: queryKeys.report('rework', query),
    queryFn: () => expectStatus(api.reports.reworkReport({ query }), 200),
    ...options,
  });
}

export function useDelaysReport() {
  const { query } = useInsightFilters();
  return useQuery({
    queryKey: queryKeys.report('delays', query),
    queryFn: () => expectStatus(api.reports.delaysReport({ query }), 200),
    ...options,
  });
}
