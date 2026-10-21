'use client';

import { Button, cn, DatePicker, Field, Popover } from '@lintel/design-system/web';
import { CalendarRange, Check, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import {
  describeRange,
  matchingPreset,
  type PeriodPreset,
  periodPresets,
  rangeProblem,
} from './period-presets';

interface PeriodPickerProps {
  readonly from: string | null;
  readonly to: string | null;
  readonly today: string;
  /** What the server uses when no range is chosen, e.g. "Last 30 days". */
  readonly defaultLabel: string;
  readonly ahead?: boolean;
  readonly onChange: (range: { from: string | null; to: string | null }) => void;
  readonly className?: string;
}

/** The label a chosen range reads as: its preset name, or its dates. */
export function periodLabel(
  from: string | null,
  to: string | null,
  today: string,
  defaultLabel: string,
): string {
  if (!from && !to) return defaultLabel;
  const start = from ?? to ?? today;
  const end = to ?? today;
  return (
    matchingPreset(periodPresets(today, { ahead: true }), start, end)?.label ??
    describeRange(start, end, today)
  );
}

/** Pick a reporting period: common ranges in one press, or any range up to a year. */
export function PeriodPicker({
  from,
  to,
  today,
  defaultLabel,
  ahead = false,
  onChange,
  className,
}: PeriodPickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ from: string | null; to: string | null }>({ from, to });
  const presets = periodPresets(today, { ahead });
  const selected = from || to ? matchingPreset(presets, from ?? today, to ?? today) : null;
  const problem = rangeProblem(draft.from, draft.to);

  const choose = (preset: PeriodPreset | null) => {
    onChange(preset ? { from: preset.from, to: preset.to } : { from: null, to: null });
    setOpen(false);
  };

  return (
    <Popover
      label="Choose a period"
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft({ from, to });
        setOpen(next);
      }}
      className="max-h-(--radix-popover-content-available-height) w-[25rem] overflow-y-auto overscroll-contain"
      trigger={
        <Button
          variant="secondary"
          size="md"
          className={cn('justify-between', className)}
          leadingIcon={<CalendarRange aria-hidden />}
          trailingIcon={<ChevronDown aria-hidden className="text-ink-faint max-sm:hidden" />}
          aria-label={`Period: ${periodLabel(from, to, today, defaultLabel)}. Change`}
        >
          <span className="truncate">{periodLabel(from, to, today, defaultLabel)}</span>
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <ul aria-label="Common periods" className="flex flex-col">
          {[{ id: 'default', label: defaultLabel, from: '', to: '' }, ...presets].map((preset) => {
            const isDefault = preset.id === 'default';
            const active = isDefault ? !from && !to : selected?.id === preset.id;
            if (!isDefault && preset.label === defaultLabel) return null;
            return (
              <li key={preset.id}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => choose(isDefault ? null : preset)}
                  className={cn(
                    'flex min-h-10 w-full items-center gap-2 rounded-md px-2.5 text-left type-body-sm pointer-coarse:min-h-11',
                    active
                      ? 'bg-sunken text-ink'
                      : 'text-ink-muted hover:bg-sunken/70 hover:text-ink',
                  )}
                >
                  <Check
                    aria-hidden
                    className={cn(
                      'size-4 shrink-0 text-accent',
                      active ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <span className="flex-1">{preset.label}</span>
                  {!isDefault && (
                    <span className="font-mono text-[0.75rem] text-ink-faint tabular-nums">
                      {describeRange(preset.from, preset.to, today)}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        <form
          className="flex flex-col gap-3 border-t border-hairline pt-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (problem) return;
            onChange(draft);
            setOpen(false);
          }}
        >
          <p className="type-label text-ink-muted">Custom range</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="From">
              <DatePicker
                value={draft.from}
                onValueChange={(value) => setDraft((current) => ({ ...current, from: value }))}
                today={today}
                {...(draft.to ? { max: draft.to } : {})}
              />
            </Field>
            <Field label="To">
              <DatePicker
                value={draft.to}
                onValueChange={(value) => setDraft((current) => ({ ...current, to: value }))}
                today={today}
                {...(draft.from ? { min: draft.from } : {})}
              />
            </Field>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p aria-live="polite" className="type-body-sm text-ink-faint">
              {draft.from || draft.to
                ? (problem ?? 'Up to a year at a time.')
                : 'Up to a year at a time.'}
            </p>
            <Button type="submit" variant="primary" size="sm" disabled={problem !== null}>
              Apply
            </Button>
          </div>
        </form>
      </div>
    </Popover>
  );
}
