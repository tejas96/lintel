'use client';

import type { Milestone, MilestoneRewardPlan } from '@lintel/api-contracts';
import { useToast } from '@lintel/design-system/web';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { recordKeys } from '@/features/rewards/use-reward-records';
import { api, expectStatus } from '@/lib/api/api-client';
import { queryKeys } from '@/lib/query/query-keys';

/** Rewards attached to the project's milestones (planners and reward reviewers only). */
export function useProjectMilestoneRewards(projectId: string, enabled: boolean) {
  return useQuery({
    queryKey: recordKeys.project(projectId),
    queryFn: () =>
      expectStatus(
        api.rewardRecords.listProjectMilestoneRewards({ params: { id: projectId } }),
        200,
      ),
    enabled,
  });
}

function useRefresh(projectId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['rewards'] });
    void queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.approvals });
  };
}

export interface MilestoneRewardInput {
  readonly milestone: Milestone;
  readonly plan: MilestoneRewardPlan | null;
  readonly scope: 'individual' | 'team';
  readonly recipientUserIds: readonly string[];
  readonly amountMinor: number;
  readonly requiredDocumentFolders: readonly MilestoneRewardPlan['requiredDocumentFolders'][number][];
  readonly note: string | null;
}

/** Attach, change or re-attach the reward of an open milestone. */
export function useSaveMilestoneReward(projectId: string) {
  const refresh = useRefresh(projectId);
  const toast = useToast();
  return useMutation({
    mutationFn: (input: MilestoneRewardInput) =>
      expectStatus(
        api.rewardRecords.saveMilestoneReward({
          params: { id: input.milestone.id },
          body: {
            scope: input.scope,
            recipientUserIds: [...input.recipientUserIds],
            amountMinor: input.amountMinor,
            requiredDocumentFolders: [...input.requiredDocumentFolders],
            note: input.note,
            version: input.plan?.version ?? null,
          },
        }),
        200,
      ),
    onSuccess: (_plan, input) => {
      refresh();
      toast({
        tone: 'success',
        title: input.plan?.state === 'planned' ? 'Reward changed' : 'Reward attached',
        description: `“${input.milestone.name}”: the people it is for have been told.`,
      });
    },
  });
}

/** Withdraw a reward before its milestone completes, with a reason. */
export function useWithdrawMilestoneReward(projectId: string) {
  const refresh = useRefresh(projectId);
  const toast = useToast();
  return useMutation({
    mutationFn: (input: { milestone: Milestone; plan: MilestoneRewardPlan; reason: string }) =>
      expectStatus(
        api.rewardRecords.withdrawMilestoneReward({
          params: { id: input.milestone.id },
          body: { version: input.plan.version, reason: input.reason },
        }),
        200,
      ),
    onSuccess: (_plan, input) => {
      refresh();
      toast({
        tone: 'success',
        title: 'Reward withdrawn',
        description: `“${input.milestone.name}”`,
      });
    },
  });
}

/** Complete a milestone whose tasks are all closed; its reward is checked in the same step. */
export function useCompleteMilestone(projectId: string) {
  const refresh = useRefresh(projectId);
  const toast = useToast();
  return useMutation({
    mutationFn: (input: { milestone: Milestone; note: string | null }) =>
      expectStatus(
        api.projects.completeMilestone({
          params: { id: input.milestone.id },
          body: { note: input.note, version: input.milestone.version },
        }),
        200,
      ),
    onSuccess: (_project, input) => {
      refresh();
      toast({
        tone: 'success',
        title: 'Milestone complete',
        description: `“${input.milestone.name}”`,
      });
    },
  });
}
