'use client';

import { cn, snappySpring } from '@lintel/design-system/web';
import { Check } from 'lucide-react';
import { motion } from 'motion/react';
import { WIZARD_STEPS } from './wizard-state';

/** Numbered steps (they are a real sequence); finished steps can be revisited. */
export function WizardStepper({
  current,
  onSelect,
}: {
  readonly current: number;
  readonly onSelect: (step: number) => void;
}) {
  return (
    <ol className="flex gap-2 overflow-x-auto sm:gap-4">
      {WIZARD_STEPS.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={label} className="relative flex min-w-0 flex-1 flex-col gap-2">
            <span className="relative block h-1 overflow-hidden rounded-full bg-sunken">
              {active && (
                <motion.span
                  layoutId="wizard-progress"
                  transition={snappySpring}
                  className="absolute inset-0 rounded-full bg-accent"
                />
              )}
              {done && <span className="absolute inset-0 rounded-full bg-done-solid" />}
            </span>
            <button
              type="button"
              disabled={!done}
              onClick={() => onSelect(index)}
              aria-current={active ? 'step' : undefined}
              className={cn(
                'flex min-h-9 items-center gap-2 rounded-sm text-left type-body-sm',
                active
                  ? 'font-medium text-ink'
                  : done
                    ? 'text-ink-muted hover:text-ink'
                    : 'text-ink-faint',
              )}
            >
              <span
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full text-[0.6875rem] font-semibold tabular-nums',
                  active
                    ? 'bg-accent text-on-accent'
                    : done
                      ? 'bg-done-solid text-raised'
                      : 'border border-rule',
                )}
              >
                {done ? <Check aria-hidden className="size-3" /> : index + 1}
              </span>
              <span className="truncate">{label}</span>
              {done && <span className="sr-only">(done)</span>}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
