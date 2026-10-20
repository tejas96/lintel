import type { CapacityOverview } from '@lintel/api-contracts';
import { cn, type LoadStatus, StatusGlyph } from '@lintel/design-system/web';
import type { ReactNode } from 'react';
import { formatMinutes } from '@/lib/format/dates';
import { LOAD_PRESENTATION } from './load-presentation';

const ORDER: readonly LoadStatus[] = ['overloaded', 'stretched', 'balanced', 'available'];

/** How many people sit at each load, and the estimate assumption when it applies. */
export function CapacitySummary({ overview }: { readonly overview: CapacityOverview }) {
  const assumed = overview.people.filter((person) => person.usesDefaultEstimates).length;
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-wrap gap-x-5 gap-y-2">
        {ORDER.map((status) => {
          const count = overview.people.filter((person) => person.status === status).length;
          const presentation = LOAD_PRESENTATION[status];
          return (
            <li key={status} className="flex items-baseline gap-2">
              <span className="font-display text-[1.5rem] leading-none text-ink tabular-nums">
                {count}
              </span>
              <span className="inline-flex items-center gap-1.5 type-body-sm text-ink-muted">
                <StatusGlyph
                  name={presentation.glyph}
                  className={cn('size-3', presentation.text)}
                />
                {presentation.label}
              </span>
            </li>
          );
        })}
      </ul>
      {assumed > 0 && (
        <p className="type-body-sm text-ink-muted">
          <span aria-hidden className="mr-1 text-ink-faint">
            ◌
          </span>
          {assumed === 1 ? 'One person has' : `${assumed} people have`} tasks without an estimate.
          Lintel assumes {formatMinutes(overview.defaultEstimateMinutes)} for each, so their load
          may be off.
        </p>
      )}
    </div>
  );
}

function Key({ swatch, children }: { readonly swatch: ReactNode; readonly children: ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <span aria-hidden className="flex h-3 w-6 items-center">
        {swatch}
      </span>
      {children}
    </li>
  );
}

/** What each mark in the grid means. */
export function CapacityLegend() {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 type-body-sm text-ink-muted">
      <Key swatch={<span className="h-1.5 w-full rounded-full bg-on-track-solid" />}>Confirmed</Key>
      <Key swatch={<span className="h-1.5 w-full rounded-full bg-on-track-solid opacity-40" />}>
        Tentative (draft tasks)
      </Key>
      <Key swatch={<span className="lt-hatch h-1.5 w-full rounded-full bg-blocked-solid/60" />}>
        Blocked
      </Key>
      <Key
        swatch={
          <span className="relative h-1.5 w-full rounded-full bg-sunken">
            <span className="absolute inset-y-0 left-2/3 w-px bg-ink-muted" />
          </span>
        }
      >
        End of available time
      </Key>
      <Key swatch={<span className="lt-hatch h-3 w-full rounded-[3px] border border-hairline" />}>
        On leave
      </Key>
      <Key
        swatch={<span className="h-3 w-full rounded-[3px] border border-dashed border-ink-faint" />}
      >
        Leave asked
      </Key>
      <Key swatch={<span className="h-3 w-full rounded-[3px] bg-sunken" />}>Not working</Key>
    </ul>
  );
}
