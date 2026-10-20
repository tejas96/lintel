'use client';

import { motion } from 'motion/react';
import { Checkbox as CheckboxPrimitive, Switch as SwitchPrimitive } from 'radix-ui';
import { type ReactNode, useId } from 'react';
import { cn } from '../lib/cn';
import { easing, seconds, snappySpring } from '../motion/presets';

interface CheckboxProps {
  readonly checked: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
  readonly label: ReactNode;
  readonly description?: ReactNode;
  readonly disabled?: boolean;
  /** Visually strike the label when checked (checklists). */
  readonly strikeWhenChecked?: boolean;
  readonly className?: string;
}

/** A checkbox whose tick draws itself; the whole row is the hit target. */
export function Checkbox({
  checked,
  onCheckedChange,
  label,
  description,
  disabled = false,
  strikeWhenChecked = false,
  className,
}: CheckboxProps) {
  const id = useId();
  return (
    <div className={cn('group flex min-h-11 items-start gap-3 py-2', className)}>
      <CheckboxPrimitive.Root
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(state) => onCheckedChange(state === true)}
        className={cn(
          'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-[6px] border-[1.5px] border-rule bg-raised',
          'transition-colors duration-(--duration-fast) ease-standard',
          'hover:border-ink-faint data-[state=checked]:border-accent data-[state=checked]:bg-accent',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        <svg viewBox="0 0 16 16" aria-hidden className="size-3.5 text-on-accent">
          <motion.path
            d="M3.5 8.5 6.5 11.5 12.5 4.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={false}
            animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
            transition={{ duration: seconds('base'), ease: easing('outQuint') }}
          />
        </svg>
      </CheckboxPrimitive.Root>
      <label htmlFor={id} className="flex cursor-pointer flex-col gap-0.5">
        <span
          className={cn(
            'type-body text-ink transition-colors duration-(--duration-base)',
            strikeWhenChecked && checked && 'text-ink-faint line-through decoration-ink-faint/60',
          )}
        >
          {label}
        </span>
        {description && <span className="type-body-sm text-ink-faint">{description}</span>}
      </label>
    </div>
  );
}

interface SwitchProps {
  readonly checked: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
  readonly label: ReactNode;
  readonly description?: ReactNode;
  readonly disabled?: boolean;
  readonly className?: string;
}

export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  disabled = false,
  className,
}: SwitchProps) {
  const id = useId();
  return (
    <div className={cn('flex min-h-11 items-center justify-between gap-4', className)}>
      <label htmlFor={id} className="flex cursor-pointer flex-col gap-0.5">
        <span className="type-body text-ink">{label}</span>
        {description && <span className="type-body-sm text-ink-faint">{description}</span>}
      </label>
      <SwitchPrimitive.Root
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        className={cn(
          'relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border border-rule bg-sunken p-0.5',
          'transition-colors duration-(--duration-base) data-[state=checked]:border-accent data-[state=checked]:bg-accent',
          'disabled:opacity-50',
        )}
      >
        <SwitchPrimitive.Thumb asChild>
          <motion.span
            layout
            transition={snappySpring}
            className={cn(
              'block size-[1.125rem] rounded-full bg-raised shadow-e1',
              checked ? 'ml-auto' : 'ml-0',
            )}
          />
        </SwitchPrimitive.Thumb>
      </SwitchPrimitive.Root>
    </div>
  );
}
