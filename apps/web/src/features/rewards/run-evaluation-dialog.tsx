'use client';

import type { RewardPolicy } from '@lintel/api-contracts';
import { Button, Dialog, Field, Select } from '@lintel/design-system/web';
import { useState } from 'react';
import { addDays } from '@/lib/format/dates';
import { formatPeriod } from './reward-presentation';
import { useRunEvaluation } from './use-rewards';

/** The current period and the five before it, as { start, end } (months or quarters). */
function recentPeriods(today: string, period: RewardPolicy['period']) {
  const length = period === 'monthly' ? 1 : 3;
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const firstMonth = period === 'monthly' ? month : Math.floor((month - 1) / 3) * 3 + 1;
  const firstOf = (offset: number) => {
    const index = year * 12 + (firstMonth - 1) - offset * length;
    return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}-01`;
  };
  return Array.from({ length: 6 }, (_, offset) => ({
    start: firstOf(offset),
    end: addDays(firstOf(offset - 1), -1),
  }));
}

interface RunEvaluationDialogProps {
  readonly open: boolean;
  readonly policy: RewardPolicy | null;
  readonly today: string;
  readonly onOpenChange: (open: boolean) => void;
}

/** Evaluate one period now. Running it again refreshes undecided results only. */
export function RunEvaluationDialog({
  open,
  policy,
  today,
  onOpenChange,
}: RunEvaluationDialogProps) {
  const run = useRunEvaluation();
  const periods = policy ? recentPeriods(today, policy.period) : [];
  const [periodStart, setPeriodStart] = useState<string | undefined>(periods[0]?.start);
  const chosen = periodStart ?? periods[0]?.start;
  return (
    <Dialog
      open={open && policy !== null}
      onOpenChange={onOpenChange}
      size="sm"
      title="Run an evaluation"
      description={
        policy
          ? `Check everyone ${policy.scope === 'team' ? 'team by team ' : ''}against “${policy.name}” for one ${policy.period === 'monthly' ? 'month' : 'quarter'}.`
          : undefined
      }
      footer={
        <>
          <Button variant="quiet" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!policy || !chosen}
            pending={run.isPending}
            onClick={() => {
              if (!policy || !chosen) return;
              run.mutate({ policy, periodStart: chosen }, { onSuccess: () => onOpenChange(false) });
            }}
          >
            Run evaluation
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        <Field label="Period">
          <Select
            value={chosen}
            onValueChange={setPeriodStart}
            options={periods.map((range, index) => ({
              value: range.start,
              label: formatPeriod(range.start, range.end),
              ...(index === 0 ? { description: 'In progress: results may still change' } : {}),
            }))}
          />
        </Field>
        <p className="type-body-sm text-ink-muted">
          Safe to run again. Results that are already approved or declined stay as they are;
          everyone else is checked afresh, and new eligible results wait for review.
        </p>
      </div>
    </Dialog>
  );
}
