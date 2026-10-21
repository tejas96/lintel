import type { RewardChallenge } from '@lintel/api-contracts';
import type { RewardRecordKind } from '@lintel/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/api/api-client';
import { queryKeys } from '@/api/query-keys';

/** One person has a few records a month at most, so the newest 100 cover years of history. */
const MY_RECORDS = { scope: 'mine', page: 1, pageSize: 100 } as const;

/** Policies the studio runs; people who manage rewards also get inactive ones. */
export function useRewardPolicies() {
  return useQuery({
    queryKey: queryKeys.rewardPolicies,
    queryFn: ({ signal }) =>
      unwrap(api.operations.listRewardPolicies({ fetchOptions: { signal } })),
  });
}

/** My (and my team's) monthly or quarterly evaluations, with their evidence. */
export function useMyRewardEvaluations() {
  return useQuery({
    queryKey: queryKeys.myRewardEvaluations,
    queryFn: ({ signal }) =>
      unwrap(api.operations.listRewardEvaluations({ query: MY_RECORDS, fetchOptions: { signal } })),
  });
}

/** My shares of milestone rewards: planned, waiting for review and decided. */
export function useMyMilestoneRewards() {
  return useQuery({
    queryKey: queryKeys.myMilestoneRewards,
    queryFn: ({ signal }) =>
      unwrap(
        api.rewardRecords.listMilestoneRewards({ query: MY_RECORDS, fetchOptions: { signal } }),
      ),
  });
}

export interface ChallengeInput {
  readonly recordKind: RewardRecordKind;
  readonly recordId: string;
  readonly reason: string;
}

/**
 * Ask a reviewer to look at a decided record again. The records refetch either
 * way: a refusal (say, a challenge already open) means this phone is behind.
 */
export function useRaiseRewardChallenge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ChallengeInput): Promise<RewardChallenge> =>
      unwrap(api.rewardRecords.raiseRewardChallenge({ body: input })),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.rewards }),
  });
}
