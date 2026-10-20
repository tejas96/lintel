import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/api/api-client';
import { queryKeys } from '@/api/query-keys';

/** Everything waiting for the signed-in person's decision (GET /me/approvals). */
export function useApprovals(enabled = true) {
  return useQuery({
    queryKey: queryKeys.approvals,
    queryFn: ({ signal }) => unwrap(api.deliverables.myApprovalQueue({ fetchOptions: { signal } })),
    enabled,
  });
}

/** Badge count for the Approvals tab. Never retries noisily in the background. */
export function useApprovalCount(enabled: boolean): number {
  const query = useQuery({
    queryKey: queryKeys.approvals,
    queryFn: ({ signal }) => unwrap(api.deliverables.myApprovalQueue({ fetchOptions: { signal } })),
    enabled,
    refetchInterval: 120_000,
    retry: false,
  });
  return enabled ? (query.data?.length ?? 0) : 0;
}
