'use client';

import type { MilestoneRewardShare, RewardChallenge } from '@lintel/api-contracts';
import { useToast } from '@lintel/design-system/web';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, expectStatus } from '@/lib/api/api-client';
import { queryKeys } from '@/lib/query/query-keys';
import { useFailureToast } from '@/lib/query/use-failure-toast';

export type ShareFilter = 'pending_review' | 'approved' | 'rejected';
export type ChallengeFilter = 'open' | 'resolved';

/** Everything here lives under ['rewards'] so one invalidation refreshes every rewards view. */
export const recordKeys = {
  myMilestones: ['rewards', 'milestones', 'mine'] as const,
  milestoneQueue: (status: ShareFilter) => ['rewards', 'milestones', 'all', status] as const,
  myChallenges: ['rewards', 'challenges', 'mine'] as const,
  challengeQueue: (status: ChallengeFilter) => ['rewards', 'challenges', 'review', status] as const,
  project: (projectId: string) => ['rewards', 'project', projectId] as const,
};

export function useMyMilestoneRewards() {
  return useQuery({
    queryKey: recordKeys.myMilestones,
    queryFn: () =>
      expectStatus(
        api.rewardRecords.listMilestoneRewards({
          query: { scope: 'mine', page: 1, pageSize: 100 },
        }),
        200,
      ),
  });
}

export function useMilestoneRewardQueue(status: ShareFilter, enabled: boolean) {
  return useQuery({
    queryKey: recordKeys.milestoneQueue(status),
    queryFn: () =>
      expectStatus(
        api.rewardRecords.listMilestoneRewards({
          query: { scope: 'all', status, page: 1, pageSize: 100 },
        }),
        200,
      ),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useChallengeQueue(status: ChallengeFilter, enabled: boolean) {
  return useQuery({
    queryKey: recordKeys.challengeQueue(status),
    queryFn: () =>
      expectStatus(
        api.rewardRecords.listRewardChallenges({
          query: { scope: 'review', status, page: 1, pageSize: 100 },
        }),
        200,
      ),
    placeholderData: keepPreviousData,
    enabled,
  });
}

function useRewardsRefresh() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['rewards'] });
    void queryClient.invalidateQueries({ queryKey: queryKeys.approvals });
  };
}

export interface MilestoneDecisionInput {
  readonly share: MilestoneRewardShare;
  readonly decision: 'approve' | 'reject';
  readonly note: string;
  readonly adjustedAmountMinor: number | null;
}

/** Approve or decline one person's milestone reward. */
export function useDecideMilestoneReward(onStale: (error: unknown) => boolean) {
  const refresh = useRewardsRefresh();
  const toast = useToast();
  const fail = useFailureToast();
  return useMutation({
    mutationFn: (input: MilestoneDecisionInput) =>
      expectStatus(
        api.rewardRecords.decideMilestoneReward({
          params: { id: input.share.id },
          body: {
            decision: input.decision,
            note: input.note,
            adjustedAmountMinor: input.adjustedAmountMinor,
            version: input.share.version,
          },
        }),
        200,
      ),
    onSuccess: (share, input) => {
      refresh();
      toast({
        tone: 'success',
        title: input.decision === 'approve' ? 'Reward approved' : 'Reward not approved',
        description: `${share.user?.fullName ?? 'They'} ${share.user ? 'has' : 'have'} been told.`,
      });
    },
    onError: (error) => {
      if (onStale(error)) return;
      fail(error, 'record the decision');
      refresh();
    },
  });
}

export interface RaiseChallengeInput {
  readonly recordKind: 'evaluation' | 'milestone';
  readonly recordId: string;
  readonly reason: string;
}

/** Challenge a record about me; field errors come back to the sheet. */
export function useRaiseChallenge() {
  const refresh = useRewardsRefresh();
  const toast = useToast();
  return useMutation({
    mutationFn: (input: RaiseChallengeInput) =>
      expectStatus(api.rewardRecords.raiseRewardChallenge({ body: input }), 201),
    onSuccess: () => {
      refresh();
      toast({
        tone: 'success',
        title: 'Challenge sent',
        description: 'A reviewer will answer it with a note. You will be told.',
      });
    },
  });
}

export interface ResolveChallengeInput {
  readonly challenge: RewardChallenge;
  readonly outcome: 'uphold' | 'correct';
  readonly note: string;
  readonly correctedAmountMinor: number | null;
}

/** Uphold or correct a challenged record, with a note. */
export function useResolveChallenge(onStale: (error: unknown) => boolean) {
  const refresh = useRewardsRefresh();
  const toast = useToast();
  return useMutation({
    mutationFn: (input: ResolveChallengeInput) =>
      expectStatus(
        api.rewardRecords.resolveRewardChallenge({
          params: { id: input.challenge.id },
          body: {
            outcome: input.outcome,
            note: input.note,
            correctedAmountMinor: input.correctedAmountMinor,
            version: input.challenge.version,
          },
        }),
        200,
      ),
    onSuccess: (challenge) => {
      refresh();
      toast({
        tone: 'success',
        title: challenge.status === 'corrected' ? 'Record corrected' : 'Record upheld',
        description: `${challenge.raisedBy?.fullName ?? 'They'} will see your note.`,
      });
    },
    onError: (error) => {
      if (onStale(error)) return;
      refresh();
    },
  });
}
