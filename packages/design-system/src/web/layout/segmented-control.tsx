'use client';

import { motion } from 'motion/react';
import { RadioGroup } from 'radix-ui';
import { type ReactNode, useId } from 'react';
import { cn } from '../lib/cn';
import { snappySpring } from '../motion/presets';

export interface SegmentOption<TValue extends string> {
  readonly value: TValue;
  readonly label: string;
  readonly icon?: ReactNode;
  /** Hide the text on narrow screens (the icon stays, the label stays for screen readers). */
  readonly compactLabel?: boolean;
}

interface SegmentedControlProps<TValue extends string> {
  readonly value: TValue;
  readonly onValueChange: (value: TValue) => void;
  readonly options: readonly SegmentOption<TValue>[];
  readonly label: string;
  readonly size?: 'sm' | 'md';
  readonly className?: string;
}

/** A small set of mutually exclusive views; the thumb slides to the choice. */
export function SegmentedControl<TValue extends string>({
  value,
  onValueChange,
  options,
  label,
  size = 'md',
  className,
}: SegmentedControlProps<TValue>) {
  const thumbId = useId();
  return (
    <RadioGroup.Root
      aria-label={label}
      value={value}
      onValueChange={(next) => {
        const option = options.find((candidate) => candidate.value === next);
        if (option) onValueChange(option.value);
      }}
      orientation="horizontal"
      className={cn('inline-flex rounded-md border border-hairline bg-sunken p-0.5', className)}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <RadioGroup.Item
            key={option.value}
            value={option.value}
            // Always named, even when the text is hidden on narrow screens.
            aria-label={option.label}
            className={cn(
              'relative flex items-center justify-center gap-1.5 rounded-[6px] px-3 font-medium transition-colors',
              size === 'sm' ? 'h-8 text-[0.8125rem] pointer-coarse:h-10' : 'h-10 text-[0.875rem]',
              selected ? 'text-ink' : 'text-ink-muted hover:text-ink',
            )}
          >
            {selected && (
              <motion.span
                layoutId={thumbId}
                transition={snappySpring}
                className="absolute inset-0 rounded-[6px] border border-hairline bg-raised shadow-e1"
              />
            )}
            {option.icon && <span className="relative [&_svg]:size-4">{option.icon}</span>}
            <span className={cn('relative', option.compactLabel && 'max-sm:sr-only')}>
              {option.label}
            </span>
          </RadioGroup.Item>
        );
      })}
    </RadioGroup.Root>
  );
}
