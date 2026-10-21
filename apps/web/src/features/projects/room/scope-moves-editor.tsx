'use client';

import type { TaskSummary } from '@lintel/api-contracts';
import { cn, IconButton } from '@lintel/design-system/web';
import { Minus, Plus } from 'lucide-react';
import { formatCalendarDate } from '@/lib/format/dates';

/** Working-day nudges per task: earlier or later, with the current due date beside each. */
export function ScopeMovesEditor({
  tasks,
  shifts,
  today,
  cancelling,
  onShift,
}: {
  readonly tasks: readonly TaskSummary[];
  readonly shifts: Readonly<Record<string, number>>;
  readonly today: string;
  readonly cancelling: ReadonlySet<string>;
  readonly onShift: (taskId: string, delta: number) => void;
}) {
  const movable = tasks.filter((task) => task.dueDate !== null && !cancelling.has(task.id));
  if (movable.length === 0) {
    return <p className="type-body-sm text-ink-faint">No open tasks with a due date to move.</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-hairline rounded-lg border border-hairline bg-raised">
      {movable.map((task) => {
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
              onClick={() => onShift(task.id, -1)}
            >
              <Minus aria-hidden />
            </IconButton>
            <output
              aria-live="polite"
              className={cn(
                'w-20 whitespace-nowrap text-center type-body-sm tabular-nums',
                days === 0 ? 'text-ink-faint' : 'font-medium text-ink',
              )}
            >
              {days === 0
                ? 'No change'
                : `${days > 0 ? '+' : ''}${days} ${Math.abs(days) === 1 ? 'day' : 'days'}`}
            </output>
            <IconButton
              label={`Move “${task.title}” a day later`}
              size="sm"
              onClick={() => onShift(task.id, 1)}
            >
              <Plus aria-hidden />
            </IconButton>
          </li>
        );
      })}
    </ul>
  );
}
