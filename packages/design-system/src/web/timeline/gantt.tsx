'use client';

import { motion } from 'motion/react';
import { type CSSProperties, type ReactNode, useEffect, useRef } from 'react';
import { cn } from '../lib/cn';
import type { TimelineScale } from './timeline-scale';

export const GANTT_ROW_HEIGHT = 44;
export const GANTT_HEADER_HEIGHT = 40;

/** The name column's width comes from `--gantt-label`, set on the chart (regular or compact). */
const LABEL_COLUMN = 'w-(--gantt-label)';
const LABEL_WIDTHS = {
  regular: '[--gantt-label:9.5rem] sm:[--gantt-label:16rem]',
  compact: '[--gantt-label:8rem] sm:[--gantt-label:9.5rem]',
} as const;

interface GanttChartProps {
  readonly scale: TimelineScale;
  readonly today: string;
  readonly label: string;
  readonly children: ReactNode;
  /** Overlays drawn over the track area (dependency lines). */
  readonly overlay?: ReactNode;
  readonly className?: string;
  /** The date scrolled into view when the chart opens (default: today). */
  readonly focusDate?: string;
  /** A narrower name column, for charts in a side column. */
  readonly labelWidth?: keyof typeof LABEL_WIDTHS;
}

/** Scrollable chart frame: sticky name column, date header, grid, weekends and a today line. */
export function GanttChart({
  scale,
  today,
  label,
  children,
  overlay,
  className,
  focusDate,
  labelWidth = 'regular',
}: GanttChartProps) {
  const scroller = useRef<HTMLElement>(null);
  const todayX = scale.x(today);
  const focusX = scale.x(focusDate ?? today);
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    element.scrollLeft = Math.max(0, focusX - element.clientWidth / 3);
  }, [focusX]);
  const trackStyle: CSSProperties = { width: scale.width };
  return (
    <section
      ref={scroller}
      aria-label={label}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: the scroll area must be reachable by keyboard
      tabIndex={0}
      className={cn(
        'relative overflow-x-auto overscroll-x-contain rounded-lg border border-hairline bg-surface',
        LABEL_WIDTHS[labelWidth],
        className,
      )}
    >
      <div className="relative min-w-max">
        <div
          className="sticky top-0 z-20 flex border-b border-hairline bg-surface"
          style={{ height: GANTT_HEADER_HEIGHT }}
        >
          <div
            className={cn(
              'sticky left-0 z-10 flex shrink-0 items-center border-r border-hairline bg-surface px-4 type-label text-ink-faint',
              LABEL_COLUMN,
            )}
          >
            Work
          </div>
          <div className="relative shrink-0" style={trackStyle}>
            {scale.ticks
              .filter((tick) => tick.label)
              .map((tick) => (
                <span
                  key={tick.date}
                  className="absolute top-3 pl-2 type-mono whitespace-nowrap text-ink-faint"
                  style={{ left: tick.x }}
                >
                  {tick.label}
                </span>
              ))}
          </div>
        </div>
        <div className="relative">
          <GanttGrid scale={scale} todayX={todayX} />
          {/* Bars animate relative to the chart, not the page: content added above never jolts them. */}
          <motion.div layoutRoot className="relative">
            {children}
          </motion.div>
          {overlay}
        </div>
      </div>
    </section>
  );
}

function GanttGrid({ scale, todayX }: { scale: TimelineScale; todayX: number }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-y-0 right-0 left-(--gantt-label)"
    >
      {scale.dayWidth >= 24 &&
        scale.ticks
          .filter((tick) => tick.isWeekend)
          .map((tick) => (
            <span
              key={tick.date}
              className="absolute inset-y-0 bg-sunken/60"
              style={{ left: tick.x, width: scale.dayWidth }}
            />
          ))}
      {scale.ticks
        .filter((tick) => tick.gridline !== 'none')
        .map((tick) => (
          <span
            key={tick.date}
            className={cn(
              'absolute inset-y-0 w-px',
              tick.gridline === 'major' ? 'bg-hairline' : 'bg-hairline/50',
            )}
            style={{ left: tick.x }}
          />
        ))}
      <span
        className="absolute inset-y-0 w-0.5 bg-accent"
        style={{ left: todayX + scale.dayWidth / 2 }}
      >
        <span className="absolute top-1 left-1.5 rounded-sm bg-accent px-1.5 py-0.5 type-label whitespace-nowrap text-on-accent">
          Today
        </span>
      </span>
    </div>
  );
}

interface GanttRowProps {
  readonly label: ReactNode;
  readonly children?: ReactNode;
  readonly depth?: 0 | 1;
  readonly className?: string;
}

export function GanttRow({ label, children, depth = 1, className }: GanttRowProps) {
  return (
    <div
      className={cn('flex border-b border-hairline/70 last:border-b-0', className)}
      style={{ height: GANTT_ROW_HEIGHT }}
    >
      <div
        className={cn(
          'sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r border-hairline bg-surface pr-3 type-body-sm',
          depth === 0 ? 'pl-3 font-medium text-ink' : 'pl-7 text-ink-muted',
          LABEL_COLUMN,
        )}
      >
        {label}
      </div>
      <div className="relative min-w-0 flex-1">{children}</div>
    </div>
  );
}
