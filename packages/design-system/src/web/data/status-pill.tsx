import type { ReactNode } from 'react';
import { STATUS_LABELS, type StatusTone } from '../../tokens/status';
import { cn } from '../lib/cn';
import { StatusGlyph, type StatusGlyphName } from './status-glyph';

export type PillTone = StatusTone | 'neutral';

const TONE_CLASSES: Readonly<Record<PillTone, string>> = {
  onTrack: 'bg-on-track-tint text-on-track',
  atRisk: 'bg-at-risk-tint text-at-risk',
  blocked: 'bg-blocked-tint text-blocked',
  overdue: 'bg-overdue-tint text-overdue',
  review: 'bg-review-tint text-review',
  done: 'bg-done-tint text-done',
  neutral: 'bg-sunken text-ink-muted',
};

const DEFAULT_GLYPH: Readonly<Record<PillTone, StatusGlyphName>> = {
  onTrack: 'onTrack',
  atRisk: 'atRisk',
  blocked: 'blocked',
  overdue: 'overdue',
  review: 'review',
  done: 'done',
  neutral: 'ready',
};

interface StatusPillProps {
  readonly tone: PillTone;
  /** The status word. Defaults to the tone's standard label. */
  readonly label?: string;
  readonly glyph?: StatusGlyphName;
  readonly size?: 'sm' | 'md';
  readonly className?: string;
}

/** Colour + glyph + word, always together. */
export function StatusPill({ tone, label, glyph, size = 'md', className }: StatusPillProps) {
  const word = label ?? (tone === 'neutral' ? 'Not started' : STATUS_LABELS[tone]);
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full font-medium',
        size === 'sm' ? 'h-6 px-2 text-[0.75rem]' : 'h-7 px-2.5 text-[0.8125rem]',
        TONE_CLASSES[tone],
        className,
      )}
    >
      <StatusGlyph
        name={glyph ?? DEFAULT_GLYPH[tone]}
        className={size === 'sm' ? 'size-3' : undefined}
      />
      {word}
    </span>
  );
}

interface BadgeProps {
  readonly children: ReactNode;
  readonly variant?: 'outline' | 'soft' | 'accent';
  readonly className?: string;
}

/** Neutral metadata label (type, role, count). Never a status. */
export function Badge({ children, variant = 'outline', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-sm px-2 text-[0.75rem] font-medium',
        variant === 'outline' && 'border border-hairline text-ink-muted',
        variant === 'soft' && 'bg-sunken text-ink-muted',
        variant === 'accent' && 'bg-accent-soft text-on-accent-soft',
        className,
      )}
    >
      {children}
    </span>
  );
}

/** A small count bubble, e.g. unread notifications. */
export function CountBadge({ count, label }: { count: number; label: string }) {
  if (count <= 0) return null;
  return (
    <span
      role="status"
      aria-label={label}
      className="inline-flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-accent px-1 text-[0.6875rem] font-semibold text-on-accent tabular-nums"
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
