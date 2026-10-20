'use client';

import { Button, Combobox, cn, Field, Sheet, Textarea } from '@lintel/design-system/web';
import {
  Building2,
  CircleHelp,
  Handshake,
  Link2,
  type LucideIcon,
  Truck,
  UserRoundCheck,
} from 'lucide-react';
import { RadioGroup } from 'radix-ui';
import { type FormEvent, useState } from 'react';
import { usePeopleOptions } from '@/features/people/use-people-options';
import { type BlockerInput, useTaskActions } from './use-task-actions';

type Category = BlockerInput['category'];

const CATEGORIES: readonly { value: Category; label: string; hint: string; icon: LucideIcon }[] = [
  { value: 'client', label: 'Client', hint: 'A decision, approval or payment', icon: Handshake },
  { value: 'supplier', label: 'Supplier', hint: 'Material, quote or delivery', icon: Truck },
  {
    value: 'internal_dependency',
    label: 'Another task',
    hint: 'Work that must finish first',
    icon: Link2,
  },
  {
    value: 'manager_decision',
    label: 'Manager decision',
    hint: 'A call only a manager can make',
    icon: UserRoundCheck,
  },
  {
    value: 'information',
    label: 'Missing information',
    hint: 'Drawings, sizes or details',
    icon: CircleHelp,
  },
  { value: 'other', label: 'Something else', hint: 'Explain below', icon: Building2 },
];

interface ReportBlockerSheetProps {
  readonly task: { readonly id: string; readonly title: string; readonly version: number } | null;
  readonly onClose: () => void;
}

/** Says what the task is waiting on; managers are notified by the server. */
export function ReportBlockerSheet({ task, onClose }: ReportBlockerSheetProps) {
  const [category, setCategory] = useState<Category>('client');
  const [reason, setReason] = useState('');
  const [waitingOn, setWaitingOn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const people = usePeopleOptions();
  const { reportBlocker } = useTaskActions();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!task) return;
    if (reason.trim().length < 3) {
      setError('Add a short explanation so your manager knows what is needed.');
      return;
    }
    setError(null);
    reportBlocker.mutate(
      {
        taskId: task.id,
        category,
        reason: reason.trim(),
        waitingOnUserId: waitingOn,
        version: task.version,
      },
      {
        onSuccess: () => {
          setReason('');
          setWaitingOn(null);
          onClose();
        },
      },
    );
  };

  return (
    <Sheet
      open={task !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Report a blocker"
      description={task ? `What is stopping “${task.title}”?` : undefined}
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="report-blocker"
            pending={reportBlocker.isPending}
          >
            Report blocker
          </Button>
        </>
      }
    >
      <form id="report-blocker" onSubmit={submit} className="flex flex-col gap-6 p-5 sm:p-6">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 type-label text-ink-muted">What is it waiting on?</legend>
          <RadioGroup.Root
            value={category}
            onValueChange={(value) => {
              const match = CATEGORIES.find((option) => option.value === value);
              if (match) setCategory(match.value);
            }}
            className="grid grid-cols-1 gap-2 sm:grid-cols-2"
          >
            {CATEGORIES.map((option) => (
              <RadioGroup.Item
                key={option.value}
                value={option.value}
                className={cn(
                  'flex min-h-14 items-start gap-3 rounded-md border p-3 text-left transition-colors',
                  category === option.value
                    ? 'border-accent bg-accent-soft/60 text-ink'
                    : 'border-hairline bg-raised text-ink-muted hover:border-rule',
                )}
              >
                <option.icon
                  aria-hidden
                  className={cn(
                    'mt-0.5 size-4 shrink-0',
                    category === option.value && 'text-accent',
                  )}
                />
                <span className="flex flex-col">
                  <span className="type-body text-ink">{option.label}</span>
                  <span className="type-body-sm text-ink-faint">{option.hint}</span>
                </span>
              </RadioGroup.Item>
            ))}
          </RadioGroup.Root>
        </fieldset>
        <Field label="What exactly is needed?" error={error} required>
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="For example: Waiting for the client to choose between the two marble samples."
            maxLength={2000}
          />
        </Field>
        <Field
          label="Who are you waiting on?"
          hint="Optional. They will see this on their own list."
        >
          <Combobox
            options={people.options}
            value={waitingOn}
            onValueChange={setWaitingOn}
            onQueryChange={people.onQueryChange}
            loading={people.loading}
            placeholder="Search people"
            clearable
          />
        </Field>
      </form>
    </Sheet>
  );
}
