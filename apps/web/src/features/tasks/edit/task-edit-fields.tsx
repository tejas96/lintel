'use client';

import type { TaskDetail } from '@lintel/api-contracts';
import {
  DatePicker,
  Field,
  Input,
  PriorityMarker,
  Select,
  Switch,
  Textarea,
} from '@lintel/design-system/web';
import { TASK_PRIORITIES } from '@lintel/domain';
import { BellRing } from 'lucide-react';
import { dueDateMoves, type TaskEditValues } from './task-edit-values';

const PRIORITY_NAMES = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' } as const;

interface TaskEditFieldsProps {
  readonly task: TaskDetail;
  readonly values: TaskEditValues;
  readonly onChange: (values: TaskEditValues) => void;
  readonly errors: Readonly<Record<string, string>>;
  readonly today: string;
}

/** What the task is, when it is due, and how it is followed up. */
export function TaskEditFields({ task, values, onChange, errors, today }: TaskEditFieldsProps) {
  const set = <K extends keyof TaskEditValues>(key: K, value: TaskEditValues[K]) =>
    onChange({ ...values, [key]: value });
  const manages = task.viewerCanManage;
  const committed = task.status !== 'draft';
  const managerHint = 'Only the project manager can change this.';
  return (
    <div className="flex flex-col gap-8">
      <section aria-label="About the task" className="flex flex-col gap-4">
        <Field label="Title" error={errors.title} required>
          <Input
            value={values.title}
            onChange={(event) => set('title', event.target.value)}
            maxLength={200}
          />
        </Field>
        <Field label="Brief" hint="What needs doing, in a few lines." error={errors.description}>
          <Textarea
            value={values.description}
            onChange={(event) => set('description', event.target.value)}
            maxLength={5000}
            rows={4}
          />
        </Field>
        <Field
          label="Done means"
          hint="How the reviewer knows it is finished."
          error={errors.completionCriteria}
        >
          <Textarea
            value={values.completionCriteria}
            onChange={(event) => set('completionCriteria', event.target.value)}
            maxLength={2000}
            rows={3}
          />
        </Field>
      </section>
      <section aria-label="Schedule" className="grid gap-4 sm:grid-cols-2">
        <Field label="Planned start" error={errors.plannedStartDate}>
          <DatePicker
            value={values.plannedStartDate}
            onValueChange={(date) => set('plannedStartDate', date)}
            today={today}
          />
        </Field>
        <Field
          label="Due"
          hint={
            committed && !manages
              ? 'Only the project manager can move a committed date.'
              : undefined
          }
          error={errors.dueDate}
        >
          <DatePicker
            value={values.dueDate}
            onValueChange={(date) => set('dueDate', date)}
            today={today}
            disabled={committed && !manages}
          />
        </Field>
        {dueDateMoves(task, values) && (
          <Field
            label="Why does the date move?"
            hint="Kept in the schedule history. The owner is told."
            error={errors.scheduleChangeReason}
            required
            className="sm:col-span-2"
          >
            <Textarea
              value={values.scheduleChangeReason}
              onChange={(event) => set('scheduleChangeReason', event.target.value)}
              maxLength={500}
              rows={2}
            />
          </Field>
        )}
        <Field label="Estimate" hint="Hours of work, e.g. 1.5." error={errors.estimateMinutes}>
          <Input
            inputMode="decimal"
            value={values.estimateHours}
            onChange={(event) => set('estimateHours', event.target.value)}
            trailing={<span className="pr-1">h</span>}
          />
        </Field>
        <Field label="Priority" hint={manages ? undefined : managerHint} error={errors.priority}>
          <Select
            value={values.priority}
            disabled={!manages}
            onValueChange={(priority) => set('priority', priority)}
            options={TASK_PRIORITIES.map((priority) => ({
              value: priority,
              label: PRIORITY_NAMES[priority],
              icon: <PriorityMarker priority={priority} showLabel={false} />,
            }))}
          />
        </Field>
      </section>
      <section
        aria-labelledby="task-follow-up"
        className="flex flex-col gap-4 rounded-lg border border-hairline bg-surface p-4"
      >
        <h3 id="task-follow-up" className="flex items-center gap-2 type-title-md text-ink">
          <BellRing aria-hidden className="size-4 text-ink-faint" />
          Review and follow-up
        </h3>
        <Switch
          label="Needs a review"
          description={manages ? 'Someone checks the work before it is done.' : managerHint}
          checked={values.requiresReview}
          disabled={!manages}
          onCheckedChange={(requiresReview) => set('requiresReview', requiresReview)}
        />
        <Field
          label="Tell the project manager after"
          hint={
            manages
              ? 'Working days overdue. Reminders re-plan as soon as you save.'
              : `${managerHint} Working days overdue.`
          }
          error={errors.escalateAfterOverdueDays}
          className="max-w-xs"
        >
          <Input
            inputMode="numeric"
            value={values.escalateAfterOverdueDays}
            disabled={!manages}
            onChange={(event) =>
              set('escalateAfterOverdueDays', event.target.value.replace(/\D/g, '').slice(0, 2))
            }
            trailing={<span className="pr-1 whitespace-nowrap">working days</span>}
          />
        </Field>
      </section>
    </div>
  );
}
