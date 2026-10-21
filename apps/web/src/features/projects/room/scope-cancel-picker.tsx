'use client';

import type { TaskSummary } from '@lintel/api-contracts';
import { Checkbox } from '@lintel/design-system/web';
import { TaskStatusPill } from '@/features/tasks/task-presentation';

/**
 * Open tasks the change would cancel. Tasks waiting for review are left out
 * (decide the review first) and a task being moved cannot also be cancelled.
 */
export function ScopeCancelPicker({
  tasks,
  chosen,
  moving,
  onToggle,
}: {
  readonly tasks: readonly TaskSummary[];
  readonly chosen: ReadonlySet<string>;
  readonly moving: ReadonlySet<string>;
  readonly onToggle: (taskId: string, cancel: boolean) => void;
}) {
  const cancellable = tasks.filter((task) => task.status !== 'in_review');
  if (cancellable.length === 0) {
    return <p className="type-body-sm text-ink-faint">No open tasks can be cancelled.</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-hairline rounded-lg border border-hairline bg-raised">
      {cancellable.map((task) => (
        <li key={task.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
          <Checkbox
            checked={chosen.has(task.id)}
            onCheckedChange={(checked) => onToggle(task.id, checked)}
            disabled={moving.has(task.id)}
            label={task.title}
            description={moving.has(task.id) ? 'Being moved in this change.' : undefined}
            className="min-w-0 flex-1"
          />
          <TaskStatusPill status={task.status} />
        </li>
      ))}
    </ul>
  );
}
