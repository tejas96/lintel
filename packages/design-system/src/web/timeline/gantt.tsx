'use client';

import { motion } from 'motion/react';
import { type CSSProperties, type ReactNode, useEffect, useRef } from 'react';
import type { PillTone } from '../data/status-pill';
import { daysFrom, shortDate } from '../lib/calendar-math';
import { cn } from '../lib/cn';
import { easing, layoutSpring, seconds } from '../motion/presets';
import type { TimelineScale } from './timeline-scale';

export const GANTT_ROW_HEIGHT = 44;
export const GANTT_HEADER_HEIGHT = 40;

const LABEL_COLUMN = 'w-[9.5rem] sm:w-[16rem]';

interface GanttChartProps {
  readonly scale: TimelineScale;
  readonly today: string;
  readonly label: string;
  readonly children: ReactNode;
  /** Overlays drawn over the track area (dependency lines). */
  readonly overlay?: ReactNode;
  readonly className?: string;
}

/** Scrollable chart frame: sticky name column, date header, grid, weekends and a today line. */
export function GanttChart({ scale, today, label, children, overlay, className }: GanttChartProps) {
  const scroller = useRef<HTMLElement>(null);
  const todayX = scale.x(today);
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    element.scrollLeft = Math.max(0, todayX - element.clientWidth / 3);
  }, [todayX]);
  const trackStyle: CSSProperties = { width: scale.width };
  return (
    <section
      ref={scroller}
      aria-label={label}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: the scroll area must be reachable by keyboard
      tabIndex={0}
      className={cn(
        'relative overflow-x-auto overscroll-x-contain rounded-lg border border-hairline bg-surface',
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
          <div className="relative">{children}</div>
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
      className="pointer-events-none absolute inset-y-0 right-0 left-[9.5rem] sm:left-[16rem]"
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

const BAR_TONES: Readonly<Record<PillTone, string>> = {
  neutral: 'border-rule bg-raised text-ink',
  onTrack: 'border-on-track-solid/60 bg-on-track-tint text-on-track',
  atRisk: 'border-at-risk-solid/70 bg-at-risk-tint text-at-risk',
  blocked: 'border-blocked-solid/70 bg-blocked-tint text-blocked',
  overdue: 'border-overdue-solid/70 bg-overdue-tint text-overdue',
  review: 'border-review-solid/60 bg-review-tint text-review',
  done: 'border-done-solid/50 bg-done-tint text-done',
};

interface GanttBarProps {
  readonly scale: TimelineScale;
  readonly start: string;
  readonly end: string;
  readonly tone: PillTone;
  readonly title: string;
  /** Status word for the accessible name, e.g. "Blocked". */
  readonly statusLabel: string;
  readonly progress?: number | undefined;
  readonly index?: number;
  readonly onSelect?: (() => void) | undefined;
}

export function GanttBar({
  scale,
  start,
  end,
  tone,
  title,
  statusLabel,
  progress,
  index = 0,
  onSelect,
}: GanttBarProps) {
  const left = scale.x(start);
  const width = Math.max(scale.dayWidth, scale.x(end) + scale.dayWidth - left);
  const days = daysFrom(start, end) + 1;
  return (
    <motion.button
      type="button"
      layout
      onClick={onSelect}
      aria-label={`${title}, ${statusLabel}, ${shortDate(start)} to ${shortDate(end)}, ${days} days`}
      className={cn(
        'absolute top-2.5 flex h-6 origin-left items-center overflow-hidden rounded-md border text-left shadow-e1',
        'transition-shadow hover:shadow-e2',
        BAR_TONES[tone],
      )}
      style={{ left, width }}
      initial={{ opacity: 0, scaleX: 0.2 }}
      animate={{ opacity: 1, scaleX: 1 }}
      transition={{
        layout: layoutSpring,
        default: {
          duration: seconds('slow'),
          ease: easing('outQuint'),
          delay: Math.min(index, 8) * 0.03,
        },
      }}
    >
      {progress !== undefined && progress > 0 && (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 bg-current opacity-15"
          style={{ width: `${Math.min(1, progress) * 100}%` }}
        />
      )}
      <span className="relative truncate px-2 type-label">{width > 72 ? title : ''}</span>
    </motion.button>
  );
}

export function GanttMilestoneMark({
  scale,
  date,
  label,
}: {
  scale: TimelineScale;
  date: string;
  label: string;
}) {
  return (
    <span
      role="img"
      aria-label={`Milestone ${label}, ${shortDate(date)}`}
      title={`${label}, ${shortDate(date)}`}
      className="absolute top-[0.9375rem] size-3 -translate-x-1/2 rotate-45 rounded-[2px] border-2 border-ink bg-raised"
      style={{ left: scale.x(date) + scale.dayWidth / 2 }}
    />
  );
}
