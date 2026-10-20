import { cn } from '../lib/cn';

export type PriorityLevel = 'low' | 'medium' | 'high' | 'urgent';

const PRIORITY_LABELS: Readonly<Record<PriorityLevel, string>> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

const FILLED_BARS: Readonly<Record<PriorityLevel, number>> = {
  low: 1,
  medium: 2,
  high: 3,
  urgent: 3,
};

interface PriorityMarkerProps {
  readonly priority: PriorityLevel;
  /** Show the word next to the bars. When hidden, the word is still read aloud. */
  readonly showLabel?: boolean;
  readonly className?: string;
}

/**
 * Three ascending bars, like a level gauge; urgent gets a solid tab with an
 * exclamation mark so it reads at a glance without colour.
 */
export function PriorityMarker({ priority, showLabel = true, className }: PriorityMarkerProps) {
  const label = `${PRIORITY_LABELS[priority]} priority`;
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 text-ink-muted', className)}
      title={showLabel ? undefined : label}
    >
      {priority === 'urgent' ? (
        <svg viewBox="0 0 14 14" aria-hidden className="size-3.5 text-overdue">
          <rect x={1} y={1} width={12} height={12} rx={3} fill="currentColor" />
          <path d="M7 3.8v4" stroke="var(--color-raised)" strokeWidth={1.7} strokeLinecap="round" />
          <circle cx={7} cy={10.2} r={1} fill="var(--color-raised)" />
        </svg>
      ) : (
        <svg viewBox="0 0 14 14" aria-hidden className="size-3.5">
          {[0, 1, 2].map((bar) => (
            <rect
              key={bar}
              x={1.5 + bar * 4}
              y={9 - bar * 3}
              width={3}
              height={4 + bar * 3}
              rx={1}
              fill="currentColor"
              opacity={bar < FILLED_BARS[priority] ? 1 : 0.22}
            />
          ))}
        </svg>
      )}
      <span className={cn('text-[0.8125rem]', showLabel ? undefined : 'sr-only')}>
        {showLabel ? PRIORITY_LABELS[priority] : label}
      </span>
    </span>
  );
}
