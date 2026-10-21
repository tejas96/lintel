'use client';

import type { Guidance } from '@lintel/api-contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, expectStatus } from '@/lib/api/api-client';
import { queryKeys } from '@/lib/query/query-keys';

export type GuidanceTipKey = Guidance['tips'][number]['key'];

/** The person's first-run tips and which they have seen (one request, shared by every screen). */
export function useGuidance() {
  return useQuery({
    queryKey: queryKeys.guidance,
    queryFn: () => expectStatus(api.profile.getMyGuidance(), 200),
    staleTime: 5 * 60_000,
    // A tip is a nicety: never retry loudly or block the screen when it fails.
    retry: false,
  });
}

/** Remembers on the server that a tip was seen, so no device shows it again. */
export function useMarkTipSeen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tip: GuidanceTipKey) =>
      expectStatus(api.profile.markGuidanceSeen({ params: { tip }, body: {} }), 200),
    onSuccess: (guidance) => queryClient.setQueryData(queryKeys.guidance, guidance),
  });
}

/** Shows every tip again (Account). */
export function useResetTips() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => expectStatus(api.profile.resetGuidance({ body: {} }), 200),
    onSuccess: (guidance) => queryClient.setQueryData(queryKeys.guidance, guidance),
  });
}
