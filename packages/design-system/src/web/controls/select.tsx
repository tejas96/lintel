'use client';

import { Check, ChevronDown } from 'lucide-react';
import { Select as SelectPrimitive } from 'radix-ui';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { controlSurface, useField } from './field';

export interface SelectOption<TValue extends string> {
  readonly value: TValue;
  readonly label: string;
  readonly description?: string;
  readonly icon?: ReactNode;
}

interface SelectProps<TValue extends string> {
  readonly value: TValue | undefined;
  readonly onValueChange: (value: TValue) => void;
  readonly options: readonly SelectOption<TValue>[];
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly className?: string;
  /** Accessible name when the select is not inside a Field. */
  readonly label?: string;
}

export function Select<TValue extends string>({
  value,
  onValueChange,
  options,
  placeholder = 'Choose…',
  disabled,
  className,
  label,
}: SelectProps<TValue>) {
  // A control with its own label stands apart from the surrounding Field.
  const surrounding = useField();
  const field = label ? null : surrounding;
  const handleChange = (next: string) => {
    const option = options.find((candidate) => candidate.value === next);
    if (option) onValueChange(option.value);
  };
  return (
    <SelectPrimitive.Root
      {...(value === undefined ? {} : { value })}
      onValueChange={handleChange}
      {...(disabled === undefined ? {} : { disabled })}
    >
      <SelectPrimitive.Trigger
        id={field?.id}
        aria-label={label}
        aria-describedby={field?.describedBy}
        aria-invalid={field?.invalid || undefined}
        className={cn(
          controlSurface,
          'flex h-11 items-center justify-between gap-2 px-3 text-left type-body',
          'data-placeholder:text-ink-faint',
          className,
        )}
      >
        {/* The label is rendered directly so it shows before hydration too. */}
        <SelectPrimitive.Value placeholder={placeholder}>
          {options.find((option) => option.value === value)?.label}
        </SelectPrimitive.Value>
        <SelectPrimitive.Icon>
          <ChevronDown aria-hidden className="size-4 text-ink-faint" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          className={cn(
            'z-50 max-h-(--radix-select-content-available-height) min-w-(--radix-select-trigger-width)',
            'lt-pop overflow-hidden rounded-lg border border-hairline bg-raised p-1 shadow-e3',
          )}
        >
          <SelectPrimitive.Viewport>
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                className={cn(
                  'relative flex min-h-10 cursor-default select-none items-center gap-2.5 rounded-sm py-2 pr-8 pl-2.5',
                  'type-body text-ink outline-none data-highlighted:bg-sunken data-disabled:opacity-50',
                )}
              >
                {option.icon && (
                  <span className="text-ink-muted [&_svg]:size-4">{option.icon}</span>
                )}
                <span className="flex flex-col">
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                  {option.description && (
                    <span className="type-body-sm text-ink-faint">{option.description}</span>
                  )}
                </span>
                <SelectPrimitive.ItemIndicator className="absolute right-2.5 text-accent">
                  <Check aria-hidden className="size-4" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
