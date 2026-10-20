'use client';

import type { RewardPolicy } from '@lintel/api-contracts';
import { Button, EmptyState, ErrorState, Skeleton, SkeletonGroup } from '@lintel/design-system/web';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useSession } from '@/features/session/session-provider';
import { describeError } from '@/lib/api/describe-error';
import { todayIn } from '@/lib/format/dates';
import { PolicyCard } from './policy-card';
import { PolicyEditorSheet } from './policy-editor-sheet';
import { RunEvaluationDialog } from './run-evaluation-dialog';
import { useTogglePolicy } from './use-reward-policies';
import { useRewardPolicies } from './use-rewards';

/** Reward policies: create, edit, pause and run them for a period. */
export function PoliciesView() {
  const { user } = useSession();
  const policies = useRewardPolicies();
  const toggle = useTogglePolicy();
  // The sheet keeps its policy while it slides away; each opening starts fresh.
  const [sheet, setSheet] = useState<{ open: boolean; policy: RewardPolicy | null; key: number }>({
    open: false,
    policy: null,
    key: 0,
  });
  const edit = (policy: RewardPolicy | null) =>
    setSheet((current) => ({ open: true, policy, key: current.key + 1 }));
  const [running, setRunning] = useState<{ open: boolean; policy: RewardPolicy | null }>({
    open: false,
    policy: null,
  });
  const create = (
    <Button variant="primary" leadingIcon={<Plus aria-hidden />} onClick={() => edit(null)}>
      New policy
    </Button>
  );
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl type-body-sm text-ink-muted">
          Policies reward outcomes, not the number of tasks. Evaluations run automatically after
          each month or quarter; you can also run one now.
        </p>
        {policies.data && policies.data.length > 0 && create}
      </div>
      {policies.isPending && (
        <SkeletonGroup label="Loading reward policies">
          <Skeleton className="h-64 rounded-lg" />
        </SkeletonGroup>
      )}
      {policies.isError && (
        <ErrorState
          {...describeError(policies.error, { resource: 'collection' })}
          onRetry={() => policies.refetch()}
        />
      )}
      {policies.data && policies.data.length === 0 && (
        <EmptyState
          drawing="lamp"
          title="No reward policies yet"
          description="Create one to recognise dependable delivery each month or quarter."
          actions={create}
        />
      )}
      {policies.data && policies.data.length > 0 && (
        <ul className="flex flex-col gap-4">
          {policies.data.map((policy, index) => (
            <PolicyCard
              key={policy.id}
              policy={policy}
              index={index}
              onEdit={() => edit(policy)}
              onRun={() => setRunning({ open: true, policy })}
              onToggle={() => toggle.toggle(policy)}
              toggling={toggle.isPending && toggle.pendingId === policy.id}
            />
          ))}
        </ul>
      )}
      <PolicyEditorSheet
        key={sheet.key}
        open={sheet.open}
        onOpenChange={(open) => setSheet((current) => ({ ...current, open }))}
        policy={sheet.policy}
      />
      <RunEvaluationDialog
        key={running.policy?.id ?? 'none'}
        open={running.open}
        policy={running.policy}
        today={todayIn(user.timeZone)}
        onOpenChange={(open) => setRunning((current) => ({ ...current, open }))}
      />
    </div>
  );
}
