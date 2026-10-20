'use client';

import type { RewardEvaluation, RewardPolicy } from '@lintel/api-contracts';
import { useToast } from '@lintel/design-system/web';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, expectStatus } from '@/lib/api/api-client';
import { queryKeys } from '@/lib/query/query-keys';
import { useFailureToast } from '@/lib/query/use-failure-toast';
import { subjectName } from './reward-presentation';

export type ReviewFilter = 'pending_review' | 'approved' | 'rejected' | 'ineligible';

export const rewardKeys = {
  all: ['rewards'] as const,
  mine: ['rewards', 'evaluations', 'mine'] as const,
  review: (status: ReviewFilter, page: number) =>
    ['rewards', 'evaluations', 'all', status, page] as const,
  policies: ['rewards', 'policies'] as const,
};

export function useMyEvaluations() {
  return useQuery({
    queryKey: rewardKeys.mine,
    queryFn: () =>
      expectStatus(
        api.operations.listRewardEvaluations({ query: { scope: 'mine', page: 1, pageSize: 50 } }),
        200,
      ),
  });
}

export function useReviewQueue(status: ReviewFilter, page: number, enabled: boolean) {
  return useQuery({
    queryKey: rewardKeys.review(status, page),
    queryFn: () =>
      expectStatus(
        api.operations.listRewardEvaluations({
          query: { scope: 'all', status, page, pageSize: 20 },
        }),
        200,
      ),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useRewardPolicies() {
  return useQuery({
    queryKey: rewardKeys.policies,
    queryFn: () => expectStatus(api.operations.listRewardPolicies(), 200),
  });
}

export interface DecisionInput {
  readonly evaluation: RewardEvaluation;
  readonly decision: 'approve' | 'reject';
  readonly note: string;
  readonly adjustedAmountMinor: number | null;
}

/** Approve or reject one evaluation; stale versions come back to the caller. */
export function useDecideReward(onStale: (error: unknown) => boolean) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const fail = useFailureToast();
  return useMutation({
    mutationFn: (input: DecisionInput) =>
      expectStatus(
        api.operations.decideRewardEvaluation({
          params: { id: input.evaluation.id },
          body: {
            decision: input.decision,
            note: input.note,
            adjustedAmountMinor: input.adjustedAmountMinor,
            version: input.evaluation.version,
          },
        }),
        200,
      ),
    onSuccess: (evaluation, input) => {
      void queryClient.invalidateQueries({ queryKey: rewardKeys.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.approvals });
      toast({
        tone: 'success',
        title: input.decision === 'approve' ? 'Reward approved' : 'Reward not approved',
        description: `${subjectName(evaluation)} has been told.`,
      });
    },
    onError: (error) => {
      if (onStale(error)) return;
      fail(error, 'record the decision');
      void queryClient.invalidateQueries({ queryKey: rewardKeys.all });
    },
  });
}

/** Run a policy for a month or quarter. Safe to repeat; decided rewards stay as they are. */
export function useRunEvaluation() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const fail = useFailureToast();
  return useMutation({
    mutationFn: (input: { policy: RewardPolicy; periodStart: string }) =>
      expectStatus(
        api.operations.runRewardEvaluation({
          params: { id: input.policy.id },
          body: { periodStart: input.periodStart },
        }),
        200,
      ),
    onSuccess: (result, input) => {
      void queryClient.invalidateQueries({ queryKey: rewardKeys.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.approvals });
      toast({
        tone: 'success',
        title: 'Evaluation finished',
        description: `${input.policy.name}: ${result.evaluated} evaluated, ${result.eligible} eligible and waiting for review.`,
      });
    },
    onError: (error) => fail(error, 'run the evaluation'),
  });
}
