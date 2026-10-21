'use client';

import { Field, Input, SegmentedControl, Select, Switch } from '@lintel/design-system/web';
import {
  PROJECT_COST_CATEGORIES,
  PROJECT_COST_CATEGORY_LABELS,
  type ProjectCostCategory,
} from '@lintel/domain';
import { LockKeyhole } from 'lucide-react';
import { useState } from 'react';
import { rupeesToMinor } from '@/features/finances/finance-presentation';

export interface ScopeTermsValues {
  readonly requiresClientSignOff: boolean;
  readonly costRupees: string;
  readonly costCategory: ProjectCostCategory;
  readonly feeRupees: string;
  readonly feeDirection: 'more' | 'less';
}

const INITIAL: ScopeTermsValues = {
  requiresClientSignOff: false,
  costRupees: '',
  costCategory: 'other',
  feeRupees: '',
  feeDirection: 'more',
};

export interface ScopeTermsRequest {
  readonly requiresClientSignOff: boolean;
  readonly costImpactMinor: number | null;
  readonly costCategory: ProjectCostCategory | null;
  readonly feeImpactMinor: number | null;
}

/** The proposal's sign-off and money terms, as typed; amounts become paise on submit. */
export function useScopeTerms() {
  const [values, setValues] = useState<ScopeTermsValues>(INITIAL);
  const errors: Record<string, string> = {};
  const cost = values.costRupees.trim() === '' ? null : rupeesToMinor(values.costRupees);
  const fee = values.feeRupees.trim() === '' ? null : rupeesToMinor(values.feeRupees);
  if (values.costRupees.trim() !== '' && cost === null)
    errors.costImpactMinor = 'Use rupees, for example 45,000.';
  if (values.feeRupees.trim() !== '' && fee === null)
    errors.feeImpactMinor = 'Use rupees, for example 60,000.';
  const request: ScopeTermsRequest = {
    requiresClientSignOff: values.requiresClientSignOff,
    costImpactMinor: cost,
    costCategory: cost === null ? null : values.costCategory,
    feeImpactMinor: fee === null ? null : values.feeDirection === 'less' ? -fee : fee,
  };
  return {
    values,
    set: (patch: Partial<ScopeTermsValues>) => setValues((current) => ({ ...current, ...patch })),
    reset: () => setValues(INITIAL),
    errors,
    request,
  };
}

interface ScopeTermsFieldsProps {
  readonly values: ScopeTermsValues;
  readonly onChange: (patch: Partial<ScopeTermsValues>) => void;
  readonly errors: Readonly<Record<string, string>>;
  /** Only people who can see the budget see and set the money. */
  readonly showMoney: boolean;
  readonly clientName: string;
}

/** Client sign-off, and (for people who see the budget) the cost to the studio and the fee. */
export function ScopeTermsFields({
  values,
  onChange,
  errors,
  showMoney,
  clientName,
}: ScopeTermsFieldsProps) {
  const rupee = <span className="text-[0.9375rem]">₹</span>;
  return (
    <div className="flex flex-col gap-5">
      <Switch
        label={`${clientName} must sign it off first`}
        description="Approval waits until someone records who at the client confirmed it, when and how."
        checked={values.requiresClientSignOff}
        onCheckedChange={(requiresClientSignOff) => onChange({ requiresClientSignOff })}
      />
      {showMoney && (
        <fieldset className="flex flex-col gap-4 rounded-lg border border-hairline bg-surface p-4">
          <legend className="flex items-center gap-1.5 px-1 type-title-md text-ink">
            <LockKeyhole aria-hidden className="size-3.5 text-ink-faint" />
            Money
          </legend>
          <p className="-mt-1 type-body-sm text-ink-muted">
            Seen only by people who can see the budget. On approval the cost goes on the cost ledger
            and the fee changes the budget.
          </p>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
            <Field
              label="Extra cost to the studio"
              hint="Leave empty when there is none."
              error={errors.costImpactMinor}
            >
              <Input
                inputMode="decimal"
                value={values.costRupees}
                onChange={(event) =>
                  onChange({ costRupees: event.target.value.replace(/[^\d.,]/g, '') })
                }
                leading={rupee}
                placeholder="0"
              />
            </Field>
            <Field label="Spent on">
              <Select
                value={values.costCategory}
                onValueChange={(costCategory) => onChange({ costCategory })}
                disabled={values.costRupees.trim() === ''}
                options={PROJECT_COST_CATEGORIES.map((category) => ({
                  value: category,
                  label: PROJECT_COST_CATEGORY_LABELS[category],
                }))}
              />
            </Field>
          </div>
          <div className="grid items-end gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
            <Field
              label="Fee change for the client"
              hint="What was agreed with the client."
              error={errors.feeImpactMinor}
            >
              <Input
                inputMode="decimal"
                value={values.feeRupees}
                onChange={(event) =>
                  onChange({ feeRupees: event.target.value.replace(/[^\d.,]/g, '') })
                }
                leading={
                  <span className="text-[0.9375rem]">
                    {values.feeDirection === 'less' ? '−₹' : '+₹'}
                  </span>
                }
                placeholder="0"
              />
            </Field>
            <SegmentedControl
              label="The client pays"
              value={values.feeDirection}
              onValueChange={(feeDirection) => onChange({ feeDirection })}
              options={[
                { value: 'more', label: 'More' },
                { value: 'less', label: 'Less' },
              ]}
              size="sm"
              className="mb-1 self-end"
            />
          </div>
        </fieldset>
      )}
    </div>
  );
}
