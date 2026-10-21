'use client';

import { Button, DatePicker, Field, IconButton } from '@lintel/design-system/web';
import { PROJECT_ROLE_LABELS } from '@lintel/domain';
import { Minus, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { PersonCombobox } from '@/features/people/person-combobox';
import type { DraftAdjustment } from './plan-draft';
import type { OutlineTask } from './plan-outline';

export interface PlanTaskAdjustProps {
  readonly task: OutlineTask;
  readonly today: string;
  readonly changed: boolean;
  readonly onAdjust: <K extends keyof DraftAdjustment>(
    field: K,
    value: DraftAdjustment[K] | undefined,
  ) => void;
  readonly onDelete: () => void;
  readonly onReset: () => void;
}

function DurationStepper({ task, onAdjust }: Pick<PlanTaskAdjustProps, 'task' | 'onAdjust'>) {
  const set = (days: number) =>
    onAdjust('durationDays', days === task.suggestedDurationDays ? undefined : days);
  return (
    <fieldset className="flex items-center gap-1" aria-label={`Working days for ${task.title}`}>
      <IconButton
        label="One day less"
        size="sm"
        variant="secondary"
        disabled={task.durationDays <= 1}
        onClick={() => set(task.durationDays - 1)}
      >
        <Minus aria-hidden />
      </IconButton>
      <output
        aria-live="polite"
        className="min-w-[4.5rem] text-center type-body tabular-nums text-ink"
      >
        {task.durationDays} {task.durationDays === 1 ? 'day' : 'days'}
      </output>
      <IconButton
        label="One day more"
        size="sm"
        variant="secondary"
        disabled={task.durationDays >= 300}
        onClick={() => set(task.durationDays + 1)}
      >
        <Plus aria-hidden />
      </IconButton>
    </fieldset>
  );
}

/** The opened row: who does the task, when it starts and how long it takes. */
export function PlanTaskAdjust({
  task,
  today,
  changed,
  onAdjust,
  onDelete,
  onReset,
}: PlanTaskAdjustProps) {
  const planned = task.planned;
  return (
    <div className="grid gap-4 px-3 pt-2 pb-4 sm:grid-cols-2 sm:pl-14">
      <Field
        label="Who does it"
        hint={`Suggested: whoever is ${PROJECT_ROLE_LABELS[task.responsibleRole].toLowerCase()}.`}
      >
        <PersonCombobox
          value={planned?.ownerUserId ?? null}
          onValueChange={(userId) => onAdjust('ownerUserId', userId)}
          clearable
          placeholder="Nobody yet"
        />
      </Field>
      <Field
        label="Starts"
        hint={
          task.waitsFor.length > 0
            ? `Suggested after ${task.waitsFor.join(', ')}.`
            : 'Suggested from the project start.'
        }
      >
        <DatePicker
          value={planned?.plannedStartDate ?? null}
          onValueChange={(date) => onAdjust('startDate', date ?? undefined)}
          today={today}
        />
      </Field>
      <div className="flex flex-col gap-2">
        <span className="type-body-sm font-medium text-ink">Takes</span>
        <DurationStepper task={task} onAdjust={onAdjust} />
      </div>
      <div className="flex flex-wrap items-end justify-end gap-2">
        {changed && (
          <Button
            size="sm"
            variant="quiet"
            leadingIcon={<RotateCcw aria-hidden />}
            onClick={onReset}
          >
            Use the suggestion
          </Button>
        )}
        {task.isAdded && (
          <Button size="sm" variant="quiet" leadingIcon={<Trash2 aria-hidden />} onClick={onDelete}>
            Remove task
          </Button>
        )}
      </div>
    </div>
  );
}
