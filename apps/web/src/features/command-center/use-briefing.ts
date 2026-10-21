'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { toInsightQuery } from '@/features/insights/use-insight-filters';
import { api, expectStatus } from '@/lib/api/api-client';
import { queryKeys } from '@/lib/query/query-keys';

type BriefingQuery = ReturnType<typeof toInsightQuery>;

/** The briefing (health score, risk cards, deadlines, highlights, escalations) for the same filters. */
export function useBriefing(query: BriefingQuery, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.briefing(query),
    queryFn: () => expectStatus(api.insights.commandCenterBriefing({ query }), 200),
    refetchInterval: 2 * 60_000,
    placeholderData: keepPreviousData,
    enabled,
  });
}
