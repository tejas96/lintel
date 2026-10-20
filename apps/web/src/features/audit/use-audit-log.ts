'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, expectStatus } from '@/lib/api/api-client';

type AuditPage = Awaited<ReturnType<typeof fetchAuditPage>>;
export type AuditItem = AuditPage['items'][number];

export interface AuditFilters {
  readonly entityType: string | null;
  readonly actorUserId: string | null;
  readonly page: number;
}

function fetchAuditPage(filters: AuditFilters) {
  return expectStatus(
    api.operations.listAuditLog({
      query: {
        page: filters.page,
        pageSize: 30,
        ...(filters.entityType ? { entityType: filters.entityType } : {}),
        ...(filters.actorUserId ? { actorUserId: filters.actorUserId } : {}),
      },
    }),
    200,
  );
}

/** One page of the audit trail, newest first; the last page stays while the next loads. */
export function useAuditLog(filters: AuditFilters, enabled: boolean) {
  return useQuery({
    queryKey: ['audit', filters],
    queryFn: () => fetchAuditPage(filters),
    placeholderData: keepPreviousData,
    enabled,
  });
}
