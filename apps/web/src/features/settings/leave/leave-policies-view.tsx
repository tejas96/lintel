'use client';

import type { ManagedLeaveType } from '@lintel/api-contracts';
import {
  Button,
  EmptyState,
  ErrorState,
  listItemEnter,
  SkeletonGroup,
  SkeletonText,
  useToast,
} from '@lintel/design-system/web';
import { LEAVE_TYPE_LIMITS } from '@lintel/domain';
import { Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { describeError } from '@/lib/api/describe-error';
import { useFailureToast } from '@/lib/query/use-failure-toast';
import { LeaveRulesCard } from './leave-rules-card';
import { LeaveTypeRow } from './leave-type-row';
import { LeaveTypeSheet, type LeaveTypeSheetMode } from './leave-type-sheet';
import { RetireLeaveTypeDialog } from './retire-leave-type-dialog';
import { leavePoliciesKey, useLeavePolicies, useLeavePolicyMutations } from './use-leave-policies';

/** The least-used colour, so a new type is easy to tell apart on calendars. */
function nextColour(types: readonly ManagedLeaveType[]): number {
  const counts = Array.from(
    { length: LEAVE_TYPE_LIMITS.colorCount },
    (_, index) => types.filter((type) => type.isActive && type.colorIndex === index).length,
  );
  return counts.indexOf(Math.min(...counts));
}

function SectionHeading({ title, detail }: { readonly title: string; readonly detail: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <h2 className="type-title-lg text-ink">{title}</h2>
      <p className="type-body-sm text-ink-muted">{detail}</p>
    </div>
  );
}

/** Leave types and the second-approval rule, for holders of `leave.manage_policies`. */
export function LeavePoliciesView() {
  const toast = useToast();
  const fail = useFailureToast();
  const policies = useLeavePolicies();
  const { setActive } = useLeavePolicyMutations();
  const [sheet, setSheet] = useState<LeaveTypeSheetMode | null>(null);
  const [retiring, setRetiring] = useState<ManagedLeaveType | null>(null);

  if (policies.isPending)
    return (
      <SkeletonGroup label="Loading leave types">
        <SkeletonText lines={8} />
      </SkeletonGroup>
    );
  if (policies.isError)
    return (
      <ErrorState
        {...describeError(policies.error, { resource: 'collection' })}
        onRetry={() => policies.refetch()}
      />
    );

  const { rules, types } = policies.data;
  const offered = types.filter((type) => type.isActive);
  const retired = types.filter((type) => !type.isActive);
  const change = (type: ManagedLeaveType, active: boolean) =>
    setActive.mutate(
      { type, active },
      {
        onSuccess: (saved) => {
          setRetiring(null);
          toast({
            tone: 'success',
            title: active ? 'Offered again' : 'Leave type retired',
            description: saved.name,
          });
        },
        onError: (error) => {
          setRetiring(null);
          fail(error, active ? 'offer the leave type again' : 'retire the leave type', [
            leavePoliciesKey,
          ]);
        },
      },
    );
  const list = (items: readonly ManagedLeaveType[]) => (
    <ul className="flex flex-col divide-y divide-hairline overflow-hidden rounded-lg border border-hairline bg-raised">
      {items.map((type, index) => (
        <motion.li key={type.id} {...listItemEnter(index)}>
          <LeaveTypeRow
            type={type}
            onEdit={() => setSheet({ kind: 'edit', type })}
            onRetire={() => setRetiring(type)}
            onReactivate={() => change(type, true)}
            reactivating={setActive.isPending && setActive.variables?.type.id === type.id}
          />
        </motion.li>
      ))}
    </ul>
  );

  return (
    <div className="flex flex-col gap-10">
      <section aria-label="Leave rules" className="flex flex-col gap-4">
        <SectionHeading
          title="Approval"
          detail="Leave is never refused by software; these rules decide who is asked."
        />
        <LeaveRulesCard key={rules.secondApprovalAboveHalfDays} rules={rules} />
      </section>
      <section aria-label="Leave types" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SectionHeading
            title="Leave types"
            detail="What people can ask for. Allowances are your studio’s policy, not legal entitlements."
          />
          <Button
            variant="primary"
            leadingIcon={<Plus aria-hidden />}
            onClick={() => setSheet({ kind: 'add', colorIndex: nextColour(types) })}
          >
            Add leave type
          </Button>
        </div>
        {offered.length === 0 ? (
          <EmptyState
            size="section"
            drawing="chair"
            title="No leave types offered"
            description="Add the kinds of leave your studio offers, such as casual or sick leave, so people can ask for time off."
          />
        ) : (
          list(offered)
        )}
      </section>
      {retired.length > 0 && (
        <section aria-label="Retired leave types" className="flex flex-col gap-4">
          <SectionHeading
            title="Retired"
            detail="Not offered for new requests. Requests already made with them are unchanged."
          />
          {list(retired)}
        </section>
      )}
      <LeaveTypeSheet
        mode={sheet}
        onClose={() => setSheet(null)}
        onRefresh={() => void policies.refetch()}
      />
      <RetireLeaveTypeDialog
        type={retiring}
        pending={setActive.isPending}
        onCancel={() => setRetiring(null)}
        onConfirm={(type) => change(type, false)}
      />
    </div>
  );
}
