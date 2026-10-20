'use client';

import type { TaskSummary } from '@lintel/api-contracts';
import { Button, Field, IconButton, Input, Sheet, Textarea } from '@lintel/design-system/web';
import { Minus, Plus } from 'lucide-react';
import { useState } from 'react';
import { formatCalendarDate } from '@/lib/format/dates';
import { ScopeImpacts } from './scope-impacts';
import { type TaskShift, useScopeChangeMutations } from './use-scope-changes';

interface ProposeScopeSheetProps {
  readonly projectId: string;
  readonly tasks: readonly TaskSummary[];
  readonly today: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

/** Move one or more tasks, see every knock-on date before saving, then propose. */
export function ProposeScopeSheet({
  projectId,
  tasks,
  today,
  open,
  onOpenChange,
}: ProposeScopeSheetProps) {
  const { preview, propose } = useScopeChangeMutations(projectId);
  const [shifts, setShifts] = useState<Readonly<Record<string, number>>>({});
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const chosen: TaskShift[] = Object.entries(shifts)
    .filter(([, days]) => days !== 0)
    .map(([taskId, shiftWorkingDays]) => ({ taskId, shiftWorkingDays }));
  const shift = (taskId: string, delta: number) => {
    preview.reset();
    setShifts((current) => ({
      ...current,
      [taskId]: Math.max(-60, Math.min(120, (current[taskId] ?? 0) + delta)),
    }));
  };
  const submit = () => {
    if (title.trim().length < 1 || description.trim().length < 3) {
      setError('Give the change a title and say why it is needed.');
      return;
    }
    setError(null);
    propose.mutate(
      { title: title.trim(), description: description.trim(), taskShifts: chosen },
      {
        onSuccess: () => {
          setShifts({});
          setTitle('');
          setDescription('');
          preview.reset();
          onOpenChange(false);
        },
      },
    );
  };
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      width="lg"
      title="Propose a scope change"
      description="Choose the tasks that move. Lintel shows every date that follows before anything is saved."
      footer={
        <>
          <Button variant="quiet" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {preview.data ? (
            <Button variant="primary" pending={propose.isPending} onClick={submit}>
              Propose change
            </Button>
          ) : (
            <Button
              variant="primary"
              disabled={chosen.length === 0}
              pending={preview.isPending}
              onClick={() => preview.mutate(chosen)}
            >
              Preview the impact
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-6 p-5 sm:p-6">
        <ul className="flex flex-col divide-y divide-hairline rounded-lg border border-hairline bg-raised">
          {tasks.map((task) => {
            const days = shifts[task.id] ?? 0;
            return (
              <li key={task.id} className="flex items-center gap-3 px-3 py-2">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate type-body-sm text-ink">{task.title}</span>
                  <span className="type-body-sm text-ink-faint">
                    Due {task.dueDate ? formatCalendarDate(task.dueDate, today) : 'not set'}
                  </span>
                </span>
                <IconButton
                  label={`Move “${task.title}” a day earlier`}
                  size="sm"
                  onClick={() => shift(task.id, -1)}
                >
                  <Minus aria-hidden />
                </IconButton>
                <output
                  aria-live="polite"
                  className="w-16 text-center type-body-sm tabular-nums text-ink"
                >
                  {days === 0 ? 'No change' : `${days > 0 ? '+' : ''}${days} d`}
                </output>
                <IconButton
                  label={`Move “${task.title}” a day later`}
                  size="sm"
                  onClick={() => shift(task.id, 1)}
                >
                  <Plus aria-hidden />
                </IconButton>
              </li>
            );
          })}
        </ul>
        {preview.data && (
          <>
            <ScopeImpacts
              impacts={preview.data.impacts}
              projectEndImpactDays={preview.data.projectEndImpactDays}
              today={today}
            />
            <Field label="Title" required>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={200}
                placeholder="For example: Client added a study to the brief"
              />
            </Field>
            <Field label="Why is this needed?" error={error} required>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={2000}
              />
            </Field>
          </>
        )}
      </div>
    </Sheet>
  );
}
