'use client';

import type { ManagedLeaveType } from '@lintel/api-contracts';
import type { LeaveTypeDefinition } from '@lintel/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { leaveKeys } from '@/features/leave/use-leave';
import { api, expectStatus } from '@/lib/api/api-client';

export const leavePoliciesKey = ['settings', 'leave-policies'] as const;

export type LeaveTypeChanges = Partial<LeaveTypeDefinition>;

/** Leave types (retired ones too, with usage) and the studio's leave rules. */
export function useLeavePolicies() {
  return useQuery({
    queryKey: leavePoliciesKey,
    queryFn: () => expectStatus(api.leavePolicies.getLeavePolicies(), 200),
  });
}

/**
 * Every change refreshes this screen and the lists people choose from, so a
 * retired type disappears from the leave form straight away.
 */
export function useLeavePolicyMutations() {
  const queryClient = useQueryClient();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: leavePoliciesKey });
    void queryClient.invalidateQueries({ queryKey: leaveKeys.types });
    void queryClient.invalidateQueries({ queryKey: leaveKeys.balances });
  };
  const create = useMutation({
    mutationFn: (definition: LeaveTypeDefinition) =>
      expectStatus(api.leavePolicies.createLeaveType({ body: definition }), 201),
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: (input: { type: ManagedLeaveType; changes: LeaveTypeChanges }) =>
      expectStatus(
        api.leavePolicies.updateLeaveType({
          params: { id: input.type.id },
          body: { ...input.changes, version: input.type.version },
        }),
        200,
      ),
    onSuccess: refresh,
  });
  const setActive = useMutation({
    mutationFn: ({ type, active }: { type: ManagedLeaveType; active: boolean }) => {
      const request = { params: { id: type.id }, body: { version: type.version } };
      return active
        ? expectStatus(api.leavePolicies.reactivateLeaveType(request), 200)
        : expectStatus(api.leavePolicies.retireLeaveType(request), 200);
    },
    onSuccess: refresh,
  });
  const updateRules = useMutation({
    mutationFn: (secondApprovalAboveHalfDays: number) =>
      expectStatus(
        api.leavePolicies.updateLeaveRules({ body: { secondApprovalAboveHalfDays } }),
        200,
      ),
    onSuccess: refresh,
  });
  return { create, update, setActive, updateRules };
}
