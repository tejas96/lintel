'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useInsightFilters } from '@/features/insights/use-insight-filters';
import { api, expectStatus } from '@/lib/api/api-client';
import { queryKeys } from '@/lib/query/query-keys';

/**
 * Each report reads the shared filters from the URL. The previous result
 * stays on screen (dimmed) while a new filter loads.
 */
const options = { placeholderData: keepPreviousData, staleTime: 60_000 } as const;

export function useDeliveryReport() {
  const { query } = useInsightFilters();
  return useQuery({
    queryKey: queryKeys.report('delivery', query),
    queryFn: () => expectStatus(api.reports.deliveryReport({ query }), 200),
    ...options,
  });
}

export function useWorkloadReport() {
  const { query } = useInsightFilters();
  return useQuery({
    queryKey: queryKeys.report('workload', query),
    queryFn: () => expectStatus(api.reports.workloadReport({ query }), 200),
    ...options,
  });
}

export function useLeaveReport() {
  const { query } = useInsightFilters();
  return useQuery({
    queryKey: queryKeys.report('leave', query),
    queryFn: () => expectStatus(api.reports.leaveReport({ query }), 200),
    ...options,
  });
}

export function useApprovalsReport() {
  const { query } = useInsightFilters();
  return useQuery({
    queryKey: queryKeys.report('approvals', query),
    queryFn: () => expectStatus(api.reports.approvalsReport({ query }), 200),
    ...options,
  });
}
