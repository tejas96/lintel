'use client';

import { cn, dataTransition, useCalmMotion } from '@lintel/design-system/web';
import { THIN_MARGIN_THRESHOLD } from '@lintel/domain';
import { motion } from 'motion/react';
import { MARGIN_PRESENTATION } from './finance-presentation';

interface BudgetBarProps {
  readonly budgetMinor: number | null;
  readonly recordedCostMinor: number;
  readonly indicator: keyof typeof MARGIN_PRESENTATION;
  readonly size?: 'sm' | 'md';
  readonly className?: string;
}

/**
 * Recorded cost against the budget on one track. The track is the budget;
 * a tick marks where the margin turns thin; spending past the budget shows
 * as a hatched overflow at the end. Decorative — the numbers beside it carry
 * the meaning.
 */
export function BudgetBar({
  budgetMinor,
  recordedCostMinor,
  indicator,
  size = 'md',
  className,
}: BudgetBarProps) {
  const calm = useCalmMotion();
  const budget = budgetMinor && budgetMinor > 0 ? budgetMinor : null;
  const over = budget !== null && recordedCostMinor > budget;
  // Over budget, the track widens to the cost so the overflow keeps its proportion.
  const span =
    budget === null ? Math.max(recordedCostMinor, 1) : Math.max(budget, recordedCostMinor);
  const spent = budget === null ? 1 : Math.min(recordedCostMinor, budget) / span;
  const overflow = over && budget !== null ? (recordedCostMinor - budget) / span : 0;
  const tick = budget === null ? null : ((1 - THIN_MARGIN_THRESHOLD) * budget) / span;
  return (
    <span
      aria-hidden
      className={cn(
        'relative flex w-full overflow-hidden rounded-full bg-sunken',
        size === 'sm' ? 'h-1.5' : 'h-2.5',
        className,
      )}
    >
      <motion.span
        className="flex h-full w-full"
        style={{ originX: 0 }}
        initial={calm ? false : { scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={dataTransition}
      >
        <span
          className={cn(
            'h-full shrink-0',
            MARGIN_PRESENTATION[indicator].bar,
            budget === null && 'opacity-40',
          )}
          style={{ width: `${(spent * 100).toFixed(2)}%` }}
        />
        {overflow > 0 && (
          <span
            className="lt-hatch h-full shrink-0 bg-overdue-solid/70"
            style={{ width: `${(overflow * 100).toFixed(2)}%` }}
          />
        )}
      </motion.span>
      {tick !== null && tick < 1 && (
        <span
          className="absolute inset-y-0 w-px bg-ink-muted/70"
          style={{ left: `${(tick * 100).toFixed(2)}%` }}
        />
      )}
      {over && budget !== null && (
        <span
          className="absolute inset-y-0 w-0.5 bg-raised"
          style={{ left: `${((budget / span) * 100).toFixed(2)}%` }}
        />
      )}
    </span>
  );
}
