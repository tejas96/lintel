'use client';

import type { TaskDetail } from '@lintel/api-contracts';
import { Button, DatePicker, Field, Sheet, Textarea } from '@lintel/design-system/web';
import { useState } from 'react';
import { formatCalendarDate } from '@/lib/format/dates';
import { useDateChangeMutations } from './use-date-changes';

type Problem = { readonly field: 'due' | 'start' | 'reason'; readonly message: string } | null;

/** The owner (or a collaborator) asks the project manager for new dates, with a reason. */
export function AskDateChangeSheet({
  task,
  today,
  open,
  onOpenChange,
}: {
  readonly task: Pick<TaskDetail, 'id' | 'title' | 'plannedStartDate' | 'dueDate'>;
  readonly today: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const { ask } = useDateChangeMutations(task.id);
  const [due, setDue] = useState<string | null>(null);
  const [start, setStart] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [problem, setProblem] = useState<Problem>(null);
  const reset = () => {
    setDue(null);
    setStart(null);
    setReason('');
    setProblem(null);
  };
  const close = () => {
    reset();
    onOpenChange(false);
  };
  const submit = () => {
    if (!due) return setProblem({ field: 'due', message: 'Choose the new due date.' });
    if (due === task.dueDate)
      return setProblem({ field: 'due', message: 'Choose a date other than the current one.' });
    if (start && start > due)
      return setProblem({ field: 'start', message: 'Start on or before the new due date.' });
    if (reason.trim().length < 3)
      return setProblem({
        field: 'reason',
        message: 'Say why, so the project manager can decide.',
      });
    setProblem(null);
    ask.mutate(
      { reason: reason.trim(), proposedStartDate: start, proposedDueDate: due },
      { onSuccess: close },
    );
  };
  const current = task.dueDate ? formatCalendarDate(task.dueDate, today) : 'no due date';
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      autoFocusField
      title="Ask for a new date"
      description={`“${task.title}” is due ${current}. The project manager accepts or declines; nothing moves until then.`}
      footer={
        <>
          <Button variant="quiet" onClick={close}>
            Cancel
          </Button>
          <Button variant="primary" pending={ask.isPending} onClick={submit}>
            Send request
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6 p-5 sm:p-6">
        <Field
          label="Why does it need a new date?"
          error={problem?.field === 'reason' ? problem.message : null}
          required
        >
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="For example: the client sends the revised brief on Monday, so the drawings can start on Tuesday."
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="New due date"
            error={problem?.field === 'due' ? problem.message : null}
            required
          >
            <DatePicker value={due} onValueChange={setDue} min={today} today={today} />
          </Field>
          <Field
            label="New start"
            hint={
              task.plannedStartDate
                ? `Now ${formatCalendarDate(task.plannedStartDate, today)}. Optional.`
                : 'Optional.'
            }
            error={problem?.field === 'start' ? problem.message : null}
          >
            <DatePicker value={start} onValueChange={setStart} min={today} today={today} />
          </Field>
        </div>
      </div>
    </Sheet>
  );
}
