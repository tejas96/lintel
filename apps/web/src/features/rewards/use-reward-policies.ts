'use client';

import type { RewardPolicy } from '@lintel/api-contracts';
import { useToast } from '@lintel/design-system/web';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, expectStatus } from '@/lib/api/api-client';
import { useFailureToast } from '@/lib/query/use-failure-toast';
import type { Criterion } from './criterion-definitions';
import { rewardKeys } from './use-rewards';

export interface PolicyInput {
  readonly name: string;
  readonly description: string | null;
  readonly scope: RewardPolicy['scope'];
  readonly period: RewardPolicy['period'];
  readonly criteria: Criterion[];
  readonly amountMinor: number;
  readonly isActive: boolean;
}

/** The fields of an existing policy, ready to send back with one change. */
export function inputOf(policy: RewardPolicy): PolicyInput {
  return {
    name: policy.name,
    description: policy.description,
    scope: policy.scope,
    period: policy.period,
    criteria: [...policy.criteria],
    amountMinor: policy.amountMinor,
    isActive: policy.isActive,
  };
}

/**
 * Create a policy, or update one at the version it was read. The caller
 * decides how to show refusals (field errors, or the stale prompt).
 */
export function useSavePolicy() {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (input: { policy: RewardPolicy | null; body: PolicyInput }) =>
      input.policy
        ? expectStatus(
            api.operations.updateRewardPolicy({
              params: { id: input.policy.id },
              body: { ...input.body, version: input.policy.version },
            }),
            200,
          )
        : expectStatus(api.operations.createRewardPolicy({ body: input.body }), 201),
    onSuccess: (policy, input) => {
      void queryClient.invalidateQueries({ queryKey: rewardKeys.policies });
      const toggled = input.policy && input.policy.isActive !== policy.isActive;
      toast({
        tone: 'success',
        title: toggled
          ? policy.isActive
            ? 'Policy turned on'
            : 'Policy paused'
          : input.policy
            ? 'Policy saved'
            : 'Policy created',
        description: toggled
          ? policy.isActive
            ? `${policy.name} will be evaluated each period.`
            : `${policy.name} won’t be evaluated until you turn it on.`
          : policy.name,
      });
    },
  });
}

/** Pause or turn on a policy straight from its card. */
export function useTogglePolicy() {
  const save = useSavePolicy();
  const fail = useFailureToast();
  return {
    isPending: save.isPending,
    pendingId: save.variables?.policy?.id ?? null,
    toggle: (policy: RewardPolicy) =>
      save.mutate(
        { policy, body: { ...inputOf(policy), isActive: !policy.isActive } },
        { onError: (error) => fail(error, 'change the policy', [rewardKeys.policies]) },
      ),
  };
}
