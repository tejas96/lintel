'use client';

import {
  Button,
  DatePicker,
  Field,
  Input,
  Select,
  Sheet,
  Textarea,
} from '@lintel/design-system/web';
import {
  PROJECT_COST_CATEGORIES,
  PROJECT_COST_CATEGORY_LABELS,
  type ProjectCostCategory,
} from '@lintel/domain';
import { type FormEvent, useState } from 'react';
import { isApiError } from '@/lib/api/api-error';
import { rupeesToMinor } from './finance-presentation';
import { useRecordCost } from './use-project-finances';

const CATEGORY_HINTS: Readonly<Record<ProjectCostCategory, string>> = {
  consultant: 'Structural, MEP, lighting and other consultants’ fees',
  material: 'Finishes, hardware, furniture and samples bought for the project',
  site: 'Contractors, labour, transport and site expenses',
  other: 'Anything else spent on this project',
};

interface RecordCostSheetProps {
  readonly projectId: string;
  readonly projectName: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly today: string;
}

/** Add one cost to the project ledger. Costs are never edited: a mistake is voided and re-entered. */
export function RecordCostSheet({
  projectId,
  projectName,
  open,
  onOpenChange,
  today,
}: RecordCostSheetProps) {
  const record = useRecordCost(projectId);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ProjectCostCategory>('material');
  const [entryDate, setEntryDate] = useState<string | null>(today);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});

  const reset = () => {
    setAmount('');
    setCategory('material');
    setEntryDate(today);
    setNote('');
    setErrors({});
  };

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const amountMinor = rupeesToMinor(amount);
    const found: Record<string, string> = {};
    if (amountMinor === null)
      found.amountMinor = 'Enter an amount in rupees, like 45000 or 1,25,000.50.';
    if (!entryDate) found.entryDate = 'Choose the day the cost was incurred.';
    setErrors(found);
    if (amountMinor === null || !entryDate) return;
    record.mutate(
      { amountMinor, category, entryDate, note: note.trim() || null },
      {
        onSuccess: () => {
          reset();
          onOpenChange(false);
        },
        onError: (error) => {
          if (isApiError(error)) {
            const fields = error.fieldErrors();
            setErrors(Object.keys(fields).length > 0 ? fields : { form: error.message });
          }
        },
      },
    );
  };

  return (
    <Sheet
      autoFocusField
      open={open}
      onOpenChange={(next) => {
        if (!next) setErrors({});
        onOpenChange(next);
      }}
      title="Record a cost"
      description={`Adds to the cost ledger of ${projectName}. Only people who can see the budget see it.`}
      footer={
        <>
          <Button variant="quiet" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" pending={record.isPending} onClick={() => submit()}>
            Record cost
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-5 p-5 sm:p-6" noValidate>
        <Field label="Amount" error={errors.amountMinor} required>
          <Input
            inputMode="decimal"
            autoComplete="off"
            value={amount}
            onChange={(event) => setAmount(event.target.value.replace(/[^\d.,]/g, ''))}
            leading={<span className="text-[0.9375rem]">₹</span>}
            className="font-mono tabular-nums"
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Category" hint={CATEGORY_HINTS[category]} error={errors.category}>
            <Select
              value={category}
              onValueChange={setCategory}
              options={PROJECT_COST_CATEGORIES.map((value) => ({
                value,
                label: PROJECT_COST_CATEGORY_LABELS[value],
              }))}
            />
          </Field>
          <Field
            label="Date"
            hint="The day it was spent or invoiced."
            error={errors.entryDate}
            required
          >
            <DatePicker value={entryDate} onValueChange={setEntryDate} max={today} today={today} />
          </Field>
        </div>
        <Field label="Note" hint="Supplier, invoice number or what it was for." error={errors.note}>
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            maxLength={500}
          />
        </Field>
        {errors.form && (
          <p role="alert" className="type-body-sm text-overdue">
            {errors.form}
          </p>
        )}
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Sheet>
  );
}
