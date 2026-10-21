'use client';

import type { CommandCenterBriefing } from '@lintel/api-contracts';
import {
  Card,
  type PillTone,
  ProgressRing,
  Sparkline,
  type StatusGlyphName,
  StatusPill,
  useCountUp,
} from '@lintel/design-system/web';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { formatCalendarDate } from '@/lib/format/dates';
import { HealthFormula } from './health-formula';
import { COMPONENT_NAMES } from './health-presentation';

type Health = CommandCenterBriefing['health'];

export const HEALTH_BAND: Readonly<
  Record<Health['band'], { tone: PillTone; glyph: StatusGlyphName; label: string; ring: string }>
> = {
  healthy: { tone: 'onTrack', glyph: 'onTrack', label: 'Healthy', ring: 'text-on-track' },
  watch: { tone: 'review', glyph: 'review', label: 'Watch', ring: 'text-review' },
  at_risk: { tone: 'atRisk', glyph: 'atRisk', label: 'At risk', ring: 'text-at-risk' },
  critical: { tone: 'overdue', glyph: 'overdue', label: 'Critical', ring: 'text-overdue' },
};

function TrendLine({ trend, today }: { readonly trend: Health['trend']; readonly today: string }) {
  const latest = trend.points[trend.points.length - 1];
  if (!trend.scopeKey) {
    return (
      <p className="type-body-sm text-ink-faint">
        The trend is recorded for the whole studio and for each manager’s projects, not for a
        project or team filter.
      </p>
    );
  }
  if (trend.points.length < 2 || !latest) {
    return (
      <p className="type-body-sm text-ink-faint">
        First reading today. Lintel records the score every morning, so the trend builds from here.
      </p>
    );
  }
  const change = trend.previousScore === null ? null : latest.score - trend.previousScore;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Sparkline
        values={trend.points.map((point) => point.score)}
        label={`Score over the last ${trend.points.length} readings, from ${trend.points[0]?.score} to ${latest.score}`}
        className="h-8 w-32 text-accent"
      />
      {change !== null && trend.previousOn && (
        <p className="type-body-sm text-ink-muted">
          {change === 0 ? 'No change' : `${change > 0 ? 'Up' : 'Down'} ${Math.abs(change)}`} since{' '}
          {formatCalendarDate(trend.previousOn, today)}
        </p>
      )}
    </div>
  );
}

/**
 * The business health score: one number out of 100 from live records, its
 * band (colour, glyph and word), the recorded trend, and the three parts that
 * take the most points, each linking to the record behind it.
 */
export function BusinessHealthCard({
  health,
  today,
}: {
  readonly health: Health;
  readonly today: string;
}) {
  const band = HEALTH_BAND[health.band];
  const shown = useCountUp(health.score);
  return (
    <Card className="flex flex-col">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-5 gap-y-4 p-5 sm:gap-x-7 sm:p-6">
        <ProgressRing
          value={health.score / 100}
          label={`Business health ${health.score} out of 100, ${band.label.toLowerCase()}`}
          size={120}
          thickness={9}
          toneClassName={band.ring}
          className="shrink-0 sm:row-span-3"
        >
          <span className="flex flex-col items-center leading-none">
            <span aria-hidden className="font-display text-[2.5rem] text-ink tabular-nums">
              {Math.round(shown)}
            </span>
            <span aria-hidden className="mt-1 font-mono text-[0.75rem] text-ink-faint">
              of 100
            </span>
          </span>
        </ProgressRing>
        <div className="flex min-w-0 flex-col items-start gap-x-3 gap-y-2 sm:flex-row sm:flex-wrap sm:items-center">
          <h2 className="type-title-lg text-ink">Business health</h2>
          <StatusPill tone={band.tone} glyph={band.glyph} label={band.label} />
          <HealthFormula health={health} />
        </div>
        <p className="col-span-2 max-w-prose type-body-sm text-ink-muted sm:col-span-1">
          Delivery risk, overdue and blocked work, decisions waiting and people overloaded, counted
          from live records. 100 means nothing in view needs attention.
        </p>
        <div className="col-span-2 sm:col-span-1">
          <TrendLine trend={health.trend} today={today} />
        </div>
      </div>
      <div className="border-t border-hairline px-2 py-3 sm:px-3">
        <h3 className="px-3 pb-1 type-label text-ink-faint">
          {health.contributors.length > 0
            ? 'Biggest contributors'
            : 'Nothing is taking points away'}
        </h3>
        <ul className="flex flex-col">
          {health.contributors.map((part) => (
            <li
              key={part.key}
              className="group relative grid grid-cols-[4.25rem_minmax(0,1fr)] items-start gap-x-3 gap-y-1 rounded-md px-3 py-2.5 hover:bg-sunken/60 md:grid-cols-[4.25rem_minmax(0,1fr)_auto] md:items-center"
            >
              <span className="font-display text-[1.375rem] leading-none text-overdue tabular-nums">
                −{part.penalty.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
              </span>
              <span className="min-w-0">
                <span className="block type-body-sm font-medium text-ink">
                  {COMPONENT_NAMES[part.key]}
                </span>
                <span className="block type-body-sm text-ink-muted">{part.summary}</span>
              </span>
              <Link
                href={part.link.linkPath}
                className="lt-stretched-link col-start-2 inline-flex items-center gap-1 rounded-sm type-body-sm font-medium text-accent md:col-start-auto"
              >
                {part.link.label}
                <ArrowRight
                  aria-hidden
                  className="size-3.5 transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
