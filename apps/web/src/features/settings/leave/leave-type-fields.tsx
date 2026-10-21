'use client';

import { cn, Field, Input, SegmentedControl, Switch, Textarea } from '@lintel/design-system/web';
import { Check } from 'lucide-react';
import { RadioGroup } from 'radix-ui';
import { SWATCH_BACKGROUNDS } from '@/features/tasks/task-presentation';
import type { LeaveTypeFormValues } from './leave-type-form';

export const SWATCH_NAMES = ['Cyanotype', 'Clay', 'Sage', 'Slate', 'Ochre', 'Plum'] as const;

interface LeaveTypeFieldsProps {
  readonly values: LeaveTypeFormValues;
  readonly onChange: (values: LeaveTypeFormValues) => void;
  readonly errors: Readonly<Record<string, string>>;
}

/** Name, colour and the rules a request of this type is checked against. */
export function LeaveTypeFields({ values, onChange, errors }: LeaveTypeFieldsProps) {
  const set = <K extends keyof LeaveTypeFormValues>(key: K, value: LeaveTypeFormValues[K]) =>
    onChange({ ...values, [key]: value });
  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-4">
        <Field label="Name" error={errors.name} required>
          <Input
            value={values.name}
            onChange={(event) => set('name', event.target.value)}
            maxLength={60}
            placeholder="For example: Work from home"
          />
        </Field>
        <Field
          label="Description"
          hint="Optional. Shown to people when they choose this type."
          error={errors.description}
        >
          <Textarea
            value={values.description}
            onChange={(event) => set('description', event.target.value)}
            maxLength={300}
            rows={2}
          />
        </Field>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 type-label text-ink-muted">Colour on calendars</legend>
          <RadioGroup.Root
            value={String(values.colorIndex)}
            onValueChange={(value) => set('colorIndex', Number(value))}
            className="flex flex-wrap gap-2"
            aria-label="Colour on calendars"
          >
            {SWATCH_BACKGROUNDS.map((swatch, index) => (
              <RadioGroup.Item
                key={swatch}
                value={String(index)}
                aria-label={SWATCH_NAMES[index]}
                className={cn(
                  'relative flex size-11 items-center justify-center rounded-md border transition-[border-color,box-shadow]',
                  values.colorIndex === index
                    ? 'border-ink shadow-e1'
                    : 'border-hairline hover:border-rule',
                )}
              >
                <span aria-hidden className={cn('size-6 rounded-sm', swatch)} />
                <RadioGroup.Indicator className="absolute inset-0 flex items-center justify-center">
                  <Check aria-hidden className="size-3.5 text-canvas drop-shadow-sm" />
                </RadioGroup.Indicator>
              </RadioGroup.Item>
            ))}
          </RadioGroup.Root>
        </fieldset>
      </div>
      <section
        aria-labelledby="leave-type-rules"
        className="flex flex-col gap-4 rounded-lg border border-hairline bg-surface p-4"
      >
        <h3 id="leave-type-rules" className="type-title-md text-ink">
          Rules for requests
        </h3>
        <Switch
          label="Needs a reason"
          description="People say why when they ask for this leave."
          checked={values.requiresReason}
          onCheckedChange={(requiresReason) => set('requiresReason', requiresReason)}
        />
        <Switch
          label="Half days allowed"
          description="A single morning or afternoon can be requested."
          checked={values.allowsHalfDay}
          onCheckedChange={(allowsHalfDay) => set('allowsHalfDay', allowsHalfDay)}
        />
        <Field
          label="Minimum notice"
          hint="Shorter notice is still allowed; the approver sees a warning."
          error={errors.minimumNoticeDays}
          className="max-w-xs"
        >
          <Input
            inputMode="numeric"
            value={values.minimumNoticeDays}
            onChange={(event) =>
              set('minimumNoticeDays', event.target.value.replace(/\D/g, '').slice(0, 2))
            }
            trailing={<span className="pr-1">days</span>}
          />
        </Field>
        <div className="flex flex-col gap-3">
          <SegmentedControl
            label="Yearly allowance"
            value={values.tracksAllowance ? 'tracked' : 'none'}
            onValueChange={(choice) => set('tracksAllowance', choice === 'tracked')}
            options={[
              { value: 'tracked', label: 'Yearly allowance' },
              { value: 'none', label: 'No allowance' },
            ]}
          />
          {values.tracksAllowance ? (
            <Field
              label="Days a year"
              hint="Going over is allowed and shown as a warning. Not a statutory entitlement."
              error={errors.annualAllowanceHalfDays}
              className="max-w-xs"
            >
              <Input
                inputMode="decimal"
                value={values.allowanceDays}
                onChange={(event) => set('allowanceDays', event.target.value)}
                trailing={<span className="pr-1">days</span>}
              />
            </Field>
          ) : (
            <p className="type-body-sm text-ink-muted">
              No balance is kept. Requests are still approved as usual.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
