'use client';

import type { CommandCenterBriefing } from '@lintel/api-contracts';
import { Popover } from '@lintel/design-system/web';
import { Info } from 'lucide-react';
import { COMPONENT_NAMES, COMPONENT_RULES } from './health-presentation';

const decimal = (value: number) => value.toLocaleString('en-IN', { maximumFractionDigits: 1 });

/** The whole formula: every part, its weight, what it measures and what it takes away now. */
export function HealthFormula({ health }: { readonly health: CommandCenterBriefing['health'] }) {
  const lost = health.components.reduce((sum, part) => sum + part.penalty, 0);
  return (
    <Popover
      label="How the business health score is worked out"
      align="start"
      className="w-[min(26rem,calc(100vw-2rem))]"
      trigger={
        <button
          type="button"
          className="-ml-1.5 inline-flex min-h-8 items-center gap-1.5 rounded-sm px-1.5 type-body-sm sm:ml-0 text-ink-muted hover:text-ink pointer-coarse:min-h-11"
        >
          <Info aria-hidden className="size-4" />
          How it’s scored
        </button>
      }
    >
      <div className="flex max-h-[min(40rem,70vh)] flex-col gap-4 overflow-y-auto p-4">
        <div>
          <p className="type-title-md text-ink">100 minus five penalties</p>
          <p className="mt-1 type-body-sm text-ink-muted">
            Each part grows in a straight line with what it measures, up to its weight. Formula{' '}
            <span className="font-mono text-[0.75rem]">{health.formula}</span>.
          </p>
        </div>
        <ul className="flex flex-col gap-3">
          {health.components.map((part) => (
            <li key={part.key} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="type-body-sm font-medium text-ink">
                  {COMPONENT_NAMES[part.key]}
                </span>
                <span className="font-mono text-[0.75rem] text-ink-muted tabular-nums">
                  −{decimal(part.penalty)} of {part.weight}
                </span>
              </div>
              <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-sunken">
                <div
                  className="h-full rounded-full bg-overdue-solid transition-[width] duration-(--duration-slow)"
                  style={{ width: `${(part.penalty / part.weight) * 100}%` }}
                />
              </div>
              <p className="type-body-sm text-ink-faint">{COMPONENT_RULES[part.key]}</p>
              <p className="type-body-sm text-ink-muted">{part.summary}</p>
            </li>
          ))}
        </ul>
        <p className="border-t border-hairline pt-3 font-mono text-[0.75rem] text-ink-muted tabular-nums">
          100 − {decimal(lost)} = {health.score}
        </p>
      </div>
    </Popover>
  );
}
