'use client';

import type { EstimateTallyView } from '@lintel/api-contracts';
import { type PillTone, type StatusGlyphName, StatusPill } from '@lintel/design-system/web';
import { formatRate } from './report-format';
import { SplitBar } from './report-parts';

export type EffortStatus = 'within' | 'over' | 'under';

/** Effort is a status: colour, glyph and word together (static classes for Tailwind). */
export const EFFORT_PRESENTATION: Readonly<
  Record<EffortStatus, { tone: PillTone; glyph: StatusGlyphName; label: string; bar: string }>
> = {
  within: { tone: 'onTrack', glyph: 'onTrack', label: 'Within', bar: 'bg-on-track-solid' },
  over: { tone: 'atRisk', glyph: 'atRisk', label: 'Over', bar: 'bg-at-risk-solid' },
  under: { tone: 'done', glyph: 'ready', label: 'Under', bar: 'bg-done-solid' },
};

/** The same 80 %–120 % band the server applies to each task, read on a group's ratio. */
export function effortStatus(ratio: number | null): EffortStatus | null {
  if (ratio === null) return null;
  if (ratio > 1.2) return 'over';
  if (ratio < 0.8) return 'under';
  return 'within';
}

const NUM = 'font-mono text-[0.8125rem] tabular-nums';

/** Logged ÷ estimated with its status word, and the within / over / under split of the tasks. */
export function EffortCell({ tally }: { readonly tally: EstimateTallyView }) {
  const status = effortStatus(tally.effortRatio);
  if (status === null) {
    return <span className="type-body-sm text-ink-faint">Not measured</span>;
  }
  const presentation = EFFORT_PRESENTATION[status];
  return (
    <span className="flex min-w-40 flex-col items-end gap-1.5 md:items-stretch">
      <span className="flex items-center justify-end gap-2 md:justify-between">
        <span className={`${NUM} text-ink`}>{formatRate(tally.effortRatio)}</span>
        <StatusPill
          tone={presentation.tone}
          glyph={presentation.glyph}
          label={presentation.label}
          size="sm"
        />
      </span>
      <SplitBar
        className="hidden md:flex"
        parts={(['within', 'over', 'under'] as const).map((key) => ({
          key,
          value: tally[key],
          className: EFFORT_PRESENTATION[key].bar,
        }))}
      />
      <span className="type-body-sm text-ink-faint">
        {tally.within} within · {tally.over} over · {tally.under} under
      </span>
    </span>
  );
}
