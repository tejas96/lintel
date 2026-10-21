'use client';

import { motion } from 'motion/react';
import { cn } from '../lib/cn';
import { dataTransition, easing, seconds } from '../motion/presets';
import { Tooltip } from '../overlays/popover';

interface SparklineProps {
  readonly values: readonly number[];
  readonly label: string;
  readonly className?: string;
  readonly width?: number;
  readonly height?: number;
}

/** A single-series trend line that draws itself; the last point is marked. */
export function Sparkline({ values, label, className, width = 120, height = 32 }: SparklineProps) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const pad = 4;
  const points = values.map((value, index) => ({
    x: pad + (index / (values.length - 1)) * (width - pad * 2),
    y: pad + (1 - (value - min) / span) * (height - pad * 2),
  }));
  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`)
    .join(' ');
  const last = points[points.length - 1];
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${width} ${height}`}
      className={cn('h-8 w-30 text-ink', className)}
    >
      <motion.path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={dataTransition}
      />
      {last && (
        <motion.circle
          cx={last.x}
          cy={last.y}
          r={3}
          className="fill-raised"
          stroke="currentColor"
          strokeWidth={2}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: seconds('data'), duration: seconds('fast') }}
        />
      )}
    </svg>
  );
}

export interface TrendBarDatum {
  readonly key: string;
  readonly label: string;
  /** Good part (bottom), e.g. delivered on time. */
  readonly good: number;
  /** Bad part (stacked on top), e.g. delivered late. */
  readonly bad: number;
  /** Optional short axis label under the bar ("13 Oct"); decorative, the label carries the meaning. */
  readonly tick?: string;
}

interface TrendBarsProps {
  readonly data: readonly TrendBarDatum[];
  readonly goodLabel: string;
  readonly badLabel: string;
  readonly label: string;
  readonly height?: number;
  readonly className?: string;
}

/**
 * Stacked two-part bars over time (on time vs late). Status colours carry the
 * meaning, the legend names them, and each bar has a tooltip with exact values.
 */
export function TrendBars({
  data,
  goodLabel,
  badLabel,
  label,
  height = 96,
  className,
}: TrendBarsProps) {
  const max = Math.max(1, ...data.map((datum) => datum.good + datum.bad));
  return (
    <figure className={cn('flex flex-col gap-3', className)}>
      <ul aria-label={label} className="flex items-end gap-1.5" style={{ height }}>
        {data.map((datum, index) => {
          const total = datum.good + datum.bad;
          const goodHeight = (datum.good / max) * height;
          const badHeight = (datum.bad / max) * height;
          return (
            <li key={datum.key} className="flex h-full min-w-2 flex-1">
              <Tooltip
                content={`${datum.label}: ${datum.good} ${goodLabel.toLowerCase()}, ${datum.bad} ${badLabel.toLowerCase()}`}
              >
                <button
                  type="button"
                  aria-label={`${datum.label}: ${datum.good} ${goodLabel}, ${datum.bad} ${badLabel}`}
                  className="flex h-full min-w-2 flex-1 flex-col justify-end gap-[2px] rounded-sm outline-offset-2"
                >
                  {total === 0 && <span className="h-[2px] rounded-full bg-hairline" />}
                  {datum.bad > 0 && (
                    <motion.span
                      className="block origin-bottom rounded-t-[4px] bg-overdue-solid"
                      style={{ height: Math.max(2, badHeight - 1) }}
                      initial={{ scaleY: 0 }}
                      animate={{ scaleY: 1 }}
                      transition={{
                        duration: seconds('data'),
                        ease: easing('outExpo'),
                        delay: 0.1 + index * 0.03,
                      }}
                    />
                  )}
                  {datum.good > 0 && (
                    <motion.span
                      className={cn(
                        'block origin-bottom bg-on-track-solid',
                        datum.bad > 0 ? 'rounded-[1px]' : 'rounded-t-[4px]',
                      )}
                      style={{ height: Math.max(2, goodHeight - 1) }}
                      initial={{ scaleY: 0 }}
                      animate={{ scaleY: 1 }}
                      transition={{
                        duration: seconds('data'),
                        ease: easing('outExpo'),
                        delay: index * 0.03,
                      }}
                    />
                  )}
                </button>
              </Tooltip>
            </li>
          );
        })}
      </ul>
      {data.some((datum) => datum.tick) && (
        <div aria-hidden className="-mt-1.5 flex gap-1.5">
          {data.map((datum) => (
            <span
              key={datum.key}
              className="min-w-2 flex-1 text-center font-mono text-[0.6875rem] whitespace-nowrap text-ink-faint tabular-nums"
            >
              {datum.tick ?? ''}
            </span>
          ))}
        </div>
      )}
      <figcaption className="flex flex-wrap gap-4 type-body-sm text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-[3px] bg-on-track-solid" />
          {goodLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-[3px] bg-overdue-solid" />
          {badLabel}
        </span>
      </figcaption>
    </figure>
  );
}
