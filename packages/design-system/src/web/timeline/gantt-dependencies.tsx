'use client';

import { motion } from 'motion/react';
import { useId } from 'react';
import { easing } from '../motion/presets';
import { GANTT_ROW_HEIGHT } from './gantt';
import type { TimelineScale } from './timeline-scale';

export interface GanttLink {
  readonly id: string;
  readonly fromRow: number;
  /** The prerequisite's last day. */
  readonly fromDate: string;
  readonly toRow: number;
  /** The dependent's first day. */
  readonly toDate: string;
  /** The dependent cannot start on time because of this link. */
  readonly late?: boolean;
}

function routeFor(link: GanttLink, scale: TimelineScale): string {
  const half = GANTT_ROW_HEIGHT / 2;
  const x1 = scale.x(link.fromDate) + scale.dayWidth;
  const y1 = link.fromRow * GANTT_ROW_HEIGHT + half;
  const x2 = scale.x(link.toDate);
  const y2 = link.toRow * GANTT_ROW_HEIGHT + half;
  if (x2 - x1 >= 16) return `M${x1} ${y1} H${x1 + 8} V${y2} H${x2 - 1}`;
  // Not enough room: drop between the rows and come back from the left.
  const between = y1 + (y2 > y1 ? half : -half);
  return `M${x1} ${y1} H${x1 + 8} V${between} H${x2 - 10} V${y2} H${x2 - 1}`;
}

/** Elbow connectors from each prerequisite's end to its dependent's start. */
export function GanttDependencies({
  scale,
  links,
  rowCount,
}: {
  readonly scale: TimelineScale;
  readonly links: readonly GanttLink[];
  readonly rowCount: number;
}) {
  const markerId = useId();
  if (links.length === 0) return null;
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute top-0 left-(--gantt-label)"
      width={scale.width}
      height={rowCount * GANTT_ROW_HEIGHT}
    >
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 8 8"
          refX={7}
          refY={4}
          markerWidth={7}
          markerHeight={7}
          orient="auto"
        >
          <path d="M0 0 8 4 0 8Z" fill="context-stroke" />
        </marker>
      </defs>
      {links.map((link, index) => (
        <motion.path
          key={link.id}
          d={routeFor(link, scale)}
          fill="none"
          strokeWidth={1.25}
          className={link.late ? 'stroke-overdue-solid' : 'stroke-ink-faint'}
          markerEnd={`url(#${markerId})`}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.9 }}
          transition={{
            duration: 0.6,
            ease: easing('inOut'),
            delay: 0.3 + Math.min(index, 8) * 0.04,
          }}
        />
      ))}
    </svg>
  );
}
