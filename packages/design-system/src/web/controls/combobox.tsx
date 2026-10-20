'use client';

import { Check, ChevronsUpDown, LoaderCircle, X } from 'lucide-react';
import { Popover as PopoverPrimitive } from 'radix-ui';
import { type KeyboardEvent, type ReactNode, useId, useMemo, useRef, useState } from 'react';
import { cn } from '../lib/cn';
import { controlSurface, useField } from './field';

export interface ComboboxOption {
  readonly value: string;
  readonly label: string;
  readonly description?: string;
  readonly leading?: ReactNode;
}

interface ComboboxProps {
  readonly options: readonly ComboboxOption[];
  readonly value: string | null;
  readonly onValueChange: (value: string | null) => void;
  readonly placeholder?: string;
  /** Shown when nothing matches the typed text. */
  readonly emptyText?: string;
  /** Called as the person types (for server-side search). Local filtering still applies. */
  readonly onQueryChange?: (query: string) => void;
  readonly loading?: boolean;
  readonly clearable?: boolean;
  readonly disabled?: boolean;
  /** Accessible name when not inside a Field. */
  readonly label?: string;
  readonly className?: string;
}

function matches(option: ComboboxOption, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return `${option.label} ${option.description ?? ''}`.toLowerCase().includes(needle);
}

/** Type to search a list and pick one item (ARIA combobox with a listbox popup). */
export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = 'Search…',
  emptyText = 'No matches. Try a different spelling.',
  onQueryChange,
  loading = false,
  clearable = false,
  disabled = false,
  label,
  className,
}: ComboboxProps) {
  // A control with its own label stands apart from the surrounding Field.
  const surrounding = useField();
  const field = label ? null : surrounding;
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  // Remember every option seen, so a chosen item keeps its label while a search narrows the list.
  const known = useRef(new Map<string, ComboboxOption>());
  for (const option of options) known.current.set(option.value, option);
  const selected = value ? (known.current.get(value) ?? null) : null;
  const filtered = useMemo(
    () => options.filter((option) => matches(option, query)),
    [options, query],
  );

  const choose = (option: ComboboxOption) => {
    onValueChange(option.value);
    setQuery('');
    onQueryChange?.('');
    setOpen(false);
  };
  const updateQuery = (next: string) => {
    setQuery(next);
    setActive(0);
    setOpen(true);
    onQueryChange?.(next);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((current) =>
        filtered.length === 0 ? 0 : (current + step + filtered.length) % filtered.length,
      );
    } else if (event.key === 'Enter' && open) {
      const option = filtered[active];
      if (option) {
        event.preventDefault();
        choose(option);
      }
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
      setQuery('');
    }
  };
  const activeOption = open ? filtered[active] : undefined;
  const optionId = (index: number) => `${listId}-option-${index}`;

  return (
    <PopoverPrimitive.Root open={open && !disabled} onOpenChange={setOpen}>
      <PopoverPrimitive.Anchor asChild>
        <div className={cn('relative', className)}>
          <input
            ref={input}
            id={field?.id}
            role="combobox"
            aria-label={label}
            aria-describedby={field?.describedBy}
            aria-invalid={field?.invalid || undefined}
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeOption ? optionId(active) : undefined}
            disabled={disabled}
            value={open ? query : (selected?.label ?? '')}
            placeholder={selected ? selected.label : placeholder}
            onChange={(event) => updateQuery(event.target.value)}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onKeyDown={onKeyDown}
            className={cn(
              controlSurface,
              'h-11 pr-16 pl-3 type-body',
              selected?.leading && !open && 'pl-11',
            )}
          />
          {selected?.leading && !open && (
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
              {selected.leading}
            </span>
          )}
          <span className="absolute inset-y-0 right-2 flex items-center gap-0.5 text-ink-faint">
            {loading && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
            {clearable && selected && !disabled && (
              <button
                type="button"
                aria-label="Clear selection"
                onClick={() => {
                  onValueChange(null);
                  input.current?.focus();
                }}
                className="flex size-7 items-center justify-center rounded-sm hover:bg-sunken hover:text-ink"
              >
                <X aria-hidden className="size-3.5" />
              </button>
            )}
            <ChevronsUpDown aria-hidden className="size-4" />
          </span>
        </div>
      </PopoverPrimitive.Anchor>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => {
            if (
              event.target instanceof Node &&
              input.current?.parentElement?.contains(event.target)
            ) {
              event.preventDefault();
            }
          }}
          className="lt-pop z-50 max-h-72 w-(--radix-popover-trigger-width) min-w-64 overflow-y-auto rounded-lg border border-hairline bg-raised p-1 shadow-e3"
        >
          <div id={listId} role="listbox" aria-label={label ?? 'Options'}>
            {filtered.length === 0 && (
              <p className="px-3 py-3 type-body-sm text-ink-faint">
                {loading ? 'Searching…' : emptyText}
              </p>
            )}
            {filtered.map((option, index) => (
              <div
                key={option.value}
                id={optionId(index)}
                role="option"
                tabIndex={-1}
                aria-selected={option.value === value}
                onMouseEnter={() => setActive(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option)}
                onKeyDown={() => undefined}
                className={cn(
                  'flex min-h-11 cursor-pointer items-center gap-2.5 rounded-sm px-2.5 py-2',
                  index === active && 'bg-sunken',
                )}
              >
                {option.leading}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate type-body text-ink">{option.label}</span>
                  {option.description && (
                    <span className="truncate type-body-sm text-ink-faint">
                      {option.description}
                    </span>
                  )}
                </span>
                {option.value === value && <Check aria-hidden className="size-4 text-accent" />}
              </div>
            ))}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
