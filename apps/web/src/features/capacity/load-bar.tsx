'use client';

import { cn, dataTransition } from '@lintel/design-system/web';
import { motion } from 'motion/react';
import { type CapacityDay, LOAD_PRESENTATION, segmentsOf } from './load-presentation';

const percent = (share: number) => `${(share * 100).toFixed(2)}%`;

/**
 * One day's booked time on a track: confirmed work solid, tentative (draft)
 * work faded, blocked work in its own colour, and a tick where available
 * time runs out. Decorative; the cell carries the words.
 */
export function LoadBar({
  day,
  className,
  orientation = 'horizontal',
}: {
  readonly day: CapacityDay;
  readonly className?: string;
  readonly orientation?: 'horizontal' | 'vertical';
}) {
  const segments = segmentsOf(day);
  const bar = LOAD_PRESENTATION[day.status].bar;
  const vertical = orientation === 'vertical';
  const size = (share: number) =>
    vertical ? { height: percent(share) } : { width: percent(share) };
  return (
    <span
      aria-hidden
      className={cn(
        'relative flex overflow-hidden rounded-full bg-sunken',
        vertical ? 'h-full w-1.5 flex-col-reverse' : 'h-1.5 w-full',
        className,
      )}
    >
      <motion.span
        className={cn('flex', vertical ? 'h-full w-full flex-col-reverse' : 'h-full w-full')}
        initial={vertical ? { scaleY: 0 } : { scaleX: 0 }}
        animate={vertical ? { scaleY: 1 } : { scaleX: 1 }}
        style={vertical ? { originY: 1 } : { originX: 0 }}
        transition={dataTransition}
      >
        <span className={cn('shrink-0', bar)} style={size(segments.confirmed)} />
        <span className={cn('shrink-0 opacity-40', bar)} style={size(segments.tentative)} />
        <span className="lt-hatch shrink-0 bg-blocked-solid/60" style={size(segments.blocked)} />
      </motion.span>
      {segments.capacityMark !== null && segments.capacityMark < 1 && (
        <span
          className={cn('absolute bg-ink-muted', vertical ? 'inset-x-0 h-px' : 'inset-y-0 w-px')}
          style={
            vertical
              ? { bottom: percent(segments.capacityMark) }
              : { left: percent(segments.capacityMark) }
          }
        />
      )}
    </span>
  );
}
