'use client';

import { Button, layoutSpring, useCalmMotion } from '@lintel/design-system/web';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useRef } from 'react';
import type { InsightFilterKey } from './use-insight-filters';

export interface FilterChip {
  /** The filters this chip removes (the period chip removes both dates). */
  readonly keys: readonly InsightFilterKey[];
  readonly name: string;
  readonly value: string;
}

/**
 * Active filters as removable chips, with "Clear all". Removing a chip moves
 * focus to the next chip (or the previous one, or the list) so keyboard users
 * never lose their place.
 */
export function FilterChips({
  chips,
  onRemove,
  onClear,
}: {
  readonly chips: readonly FilterChip[];
  readonly onRemove: (keys: readonly InsightFilterKey[]) => void;
  readonly onClear: () => void;
}) {
  const list = useRef<HTMLUListElement>(null);
  const calm = useCalmMotion();
  const remove = (index: number) => {
    const chip = chips[index];
    if (!chip) return;
    const buttons = list.current?.querySelectorAll<HTMLButtonElement>('button[data-chip]');
    const next = buttons?.[index + 1] ?? buttons?.[index - 1] ?? null;
    onRemove(chip.keys);
    window.requestAnimationFrame(() => (next ?? list.current)?.focus());
  };
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="sr-only" aria-live="polite">
        {chips.length === 1 ? 'One filter applied.' : `${chips.length} filters applied.`}
      </span>
      <ul
        ref={list}
        tabIndex={-1}
        aria-label="Applied filters"
        className="flex flex-wrap gap-2 outline-none"
      >
        <AnimatePresence initial={false}>
          {chips.map((chip, index) => (
            <motion.li
              key={chip.keys.join('+')}
              layout={!calm}
              initial={calm ? false : { opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={calm ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
              transition={layoutSpring}
            >
              <button
                type="button"
                data-chip
                onClick={() => remove(index)}
                aria-label={`Remove filter: ${chip.name} ${chip.value}`}
                className="group inline-flex h-8 max-w-[18rem] items-center gap-1.5 rounded-full border border-rule bg-raised pr-1.5 pl-3 type-body-sm text-ink shadow-e1 transition-colors hover:border-ink-faint pointer-coarse:h-10"
              >
                <span className="shrink-0 text-ink-faint">{chip.name}</span>
                <span className="truncate font-medium">{chip.value}</span>
                <span
                  aria-hidden
                  className="flex size-5 shrink-0 items-center justify-center rounded-full text-ink-muted group-hover:bg-sunken group-hover:text-ink"
                >
                  <X className="size-3.5" />
                </span>
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
        {chips.length > 1 && (
          <li>
            <Button variant="quiet" size="sm" onClick={onClear} className="h-8 pointer-coarse:h-10">
              Clear all
            </Button>
          </li>
        )}
      </ul>
    </div>
  );
}
