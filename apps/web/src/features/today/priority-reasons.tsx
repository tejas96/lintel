'use client';

import type { WorkQueueItem } from '@lintel/api-contracts';
import { easing, seconds } from '@lintel/design-system/web';
import { motion } from 'motion/react';

/**
 * Why the server put this task first, largest factor first. Bar lengths are
 * each reason's share of the score, so the explanation is also a measure.
 */
export function PriorityReasons({ reasons }: { readonly reasons: WorkQueueItem['reasons'] }) {
  const ranked = [...reasons]
    .filter((reason) => reason.points > 0)
    .sort((left, right) => right.points - left.points);
  const largest = ranked[0]?.points ?? 1;
  if (ranked.length === 0) return null;
  return (
    <div className="flex flex-col gap-4 lg:border-l lg:border-on-blueprint/20 lg:pl-10">
      <h3 className="type-label text-on-blueprint-muted">Why it comes first</h3>
      <ol className="flex flex-col gap-4">
        {ranked.slice(0, 5).map((reason, index) => (
          <li key={reason.code} className="flex flex-col gap-1.5">
            <p className="type-body-sm text-on-blueprint">{reason.explanation}</p>
            <span
              aria-hidden
              className="block h-1 w-full overflow-hidden rounded-full bg-on-blueprint/12"
            >
              <motion.span
                className="block h-full origin-left rounded-full bg-on-blueprint/80"
                style={{ width: `${Math.max(6, (reason.points / largest) * 100)}%` }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{
                  duration: seconds('data'),
                  ease: easing('outExpo'),
                  delay: 0.35 + index * 0.08,
                }}
              />
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
