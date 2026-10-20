'use client';

import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { useCountUp } from '../motion/use-count-up';

interface KpiTileProps {
  readonly label: string;
  readonly value: number;
  readonly previousValue?: number | null;
  /** Formats the (animated) number, e.g. percentages or minutes. */
  readonly format?: (value: number) => string;
  /** Whether a rise is good news (`up`), bad news (`down`) or neither. */
  readonly goodDirection?: 'up' | 'down' | 'none';
  readonly detail?: ReactNode;
  /** A small chart under the number (Sparkline, TrendBars). */
  readonly chart?: ReactNode;
  readonly className?: string;
}

const defaultFormat = (value: number) => Math.round(value).toLocaleString('en-IN');

/** One hero number in the display serif, counting up, with its change. */
export function KpiTile({
  label,
  value,
  previousValue,
  format = defaultFormat,
  goodDirection = 'up',
  detail,
  chart,
  className,
}: KpiTileProps) {
  const shown = useCountUp(value);
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg border border-hairline bg-raised p-5',
        className,
      )}
    >
      <p className="type-body-sm text-ink-muted">{label}</p>
      <div className="flex items-end justify-between gap-3">
        <p className="type-display-lg text-ink tabular-nums">
          <span aria-hidden>{format(shown)}</span>
          <span className="sr-only">{format(value)}</span>
        </p>
        {previousValue !== undefined && previousValue !== null && (
          <Delta
            value={value}
            previous={previousValue}
            format={format}
            goodDirection={goodDirection}
          />
        )}
      </div>
      {chart}
      {detail && <div className="type-body-sm text-ink-faint">{detail}</div>}
    </div>
  );
}

function Delta({
  value,
  previous,
  format,
  goodDirection,
}: {
  value: number;
  previous: number;
  format: (value: number) => string;
  goodDirection: 'up' | 'down' | 'none';
}) {
  const change = value - previous;
  const direction = change === 0 ? 'flat' : change > 0 ? 'up' : 'down';
  const good = goodDirection !== 'none' && direction === goodDirection;
  const bad = goodDirection !== 'none' && direction !== 'flat' && direction !== goodDirection;
  const Icon = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : Minus;
  const words =
    direction === 'flat'
      ? 'No change from the previous period'
      : `${direction === 'up' ? 'Up' : 'Down'} ${format(Math.abs(change))} from ${format(previous)}`;
  return (
    <span
      title={words}
      className={cn(
        'mb-1.5 inline-flex items-center gap-0.5 rounded-sm px-1.5 py-0.5 text-[0.8125rem] font-medium tabular-nums',
        good && 'bg-on-track-tint text-on-track',
        bad && 'bg-overdue-tint text-overdue',
        !good && !bad && 'bg-sunken text-ink-muted',
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      <span aria-hidden>{direction === 'flat' ? '0' : format(Math.abs(change))}</span>
      <span className="sr-only">{words}</span>
    </span>
  );
}
