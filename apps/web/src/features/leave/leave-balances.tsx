'use client';

import type { LeaveBalance } from '@lintel/api-contracts';
import { cn, listItemEnter, ProgressRing } from '@lintel/design-system/web';
import { motion } from 'motion/react';
import { swatchClass } from '@/features/tasks/task-presentation';
import { formatHalfDays } from './use-leave';

/** One ring per leave type: the arc is what is used or booked, the number what is left. */
export function LeaveBalances({ balances }: { readonly balances: readonly LeaveBalance[] }) {
  if (balances.length === 0) return null;
  return (
    // Cards keep room for the full leave type name: as many columns as fit, never a cut-off name.
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3">
      {balances.map((balance, index) => {
        const booked = balance.usedHalfDays + balance.pendingHalfDays;
        const allowance = balance.allowanceHalfDays;
        const left = allowance === null ? null : Math.max(0, allowance - booked);
        return (
          <motion.li
            key={balance.leaveType.id}
            {...listItemEnter(index)}
            className="flex items-center gap-4 rounded-lg border border-hairline bg-raised p-4"
          >
            <ProgressRing
              value={allowance ? booked / allowance : 0}
              label={
                allowance === null
                  ? `${formatHalfDays(booked)} used`
                  : `${formatHalfDays(booked)} of ${formatHalfDays(allowance)} used or booked`
              }
              size={56}
              thickness={4}
              toneClassName="text-accent"
            >
              <span className="font-display text-[1.25rem] text-ink tabular-nums">
                {left === null ? '∞' : left / 2}
              </span>
            </ProgressRing>
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="flex items-center gap-2 type-title-md text-ink">
                <span
                  aria-hidden
                  className={cn(
                    'size-2 shrink-0 rounded-[2px]',
                    swatchClass(balance.leaveType.colorIndex),
                  )}
                />
                <span className="min-w-0 break-words">{balance.leaveType.name}</span>
              </p>
              <p className="type-body-sm text-ink-muted">
                {left === null ? 'No yearly limit' : `${formatHalfDays(left)} left this year`}
              </p>
              {balance.pendingHalfDays > 0 && (
                <p className="type-body-sm text-ink-faint">
                  {formatHalfDays(balance.pendingHalfDays)} waiting for approval
                </p>
              )}
            </div>
          </motion.li>
        );
      })}
    </ul>
  );
}
