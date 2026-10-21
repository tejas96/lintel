import type { ScopeChangeDetail } from '@lintel/api-contracts';
import Link from 'next/link';
import { ChangeMark } from '@/features/projects/template-update/change-mark';
import { formatCalendarDate } from '@/lib/format/dates';

interface AddedRow {
  readonly key: string;
  readonly title: string;
  readonly stageName: string | null;
  readonly dueDate: string | null;
  readonly ownerName: string | null;
  readonly createdTaskId: string | null;
}

interface CancelledRow {
  readonly taskId: string;
  readonly title: string;
  readonly outcome: ScopeChangeDetail['cancellations'][number]['outcome'];
  readonly skipReason: string | null;
}

const OUTCOME_WORDS = {
  pending: 'Cancelled if approved',
  cancelled: 'Cancelled',
  skipped: 'Left as it was',
} as const;

/** The tasks a scope change adds and cancels, before and after the decision. */
export function ScopeAdditions({
  added,
  cancelled,
  today,
}: {
  readonly added: readonly AddedRow[];
  readonly cancelled: readonly CancelledRow[];
  readonly today: string;
}) {
  if (added.length === 0 && cancelled.length === 0) return null;
  return (
    <ul className="flex flex-col divide-y divide-hairline rounded-md border border-hairline bg-raised">
      {added.map((task) => (
        <li key={task.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
          <ChangeMark kind="added" compact />
          <span className="min-w-0 flex-1 type-body-sm text-ink">
            {task.createdTaskId ? (
              <Link href={`/tasks/${task.createdTaskId}`} className="rounded-sm hover:underline">
                {task.title}
              </Link>
            ) : (
              task.title
            )}
            {task.stageName && <span className="text-ink-faint"> · {task.stageName}</span>}
          </span>
          <span className="type-body-sm text-ink-muted tabular-nums">
            {task.dueDate ? `Due ${formatCalendarDate(task.dueDate, today)}` : 'No due date'}
            {' · '}
            {task.ownerName ?? 'Unassigned'}
          </span>
        </li>
      ))}
      {cancelled.map((task) => (
        <li key={task.taskId} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
          <ChangeMark kind="removed" compact />
          <span className="min-w-0 flex-1 type-body-sm text-ink">
            <Link href={`/tasks/${task.taskId}`} className="rounded-sm hover:underline">
              {task.title}
            </Link>
          </span>
          <span className="type-body-sm text-ink-muted">
            {OUTCOME_WORDS[task.outcome]}
            {task.skipReason && <span className="text-ink-faint">: {task.skipReason}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Rows for a stored scope change. */
export function additionRowsOf(change: ScopeChangeDetail) {
  return {
    added: change.newTasks.map((task) => ({
      key: task.id,
      title: task.title,
      stageName: task.stage?.name ?? null,
      dueDate: task.dueDate,
      ownerName: task.owner?.fullName ?? null,
      createdTaskId: task.createdTask?.id ?? null,
    })),
    cancelled: change.cancellations.map((cancellation) => {
      const undecided = cancellation.outcome === 'pending' && change.status !== 'proposed';
      return {
        taskId: cancellation.task.id,
        title: cancellation.task.title,
        outcome: undecided ? ('skipped' as const) : cancellation.outcome,
        skipReason: undecided ? 'the change was not approved' : cancellation.skipReason,
      };
    }),
  };
}
