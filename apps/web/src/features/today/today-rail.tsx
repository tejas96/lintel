'use client';

import type { TaskSummary } from '@lintel/api-contracts';
import { Avatar, Card, CardHeader, StatusGlyph } from '@lintel/design-system/web';
import Link from 'next/link';
import { ProjectChip } from '@/features/tasks/task-presentation';

/** Work other people sent to this person for review. */
export function ReviewsWaiting({ tasks }: { readonly tasks: readonly TaskSummary[] }) {
  return (
    <Card>
      <CardHeader
        title="Reviews waiting for you"
        description={
          tasks.length === 0
            ? 'Nobody is waiting on your review.'
            : 'Others can’t finish until you decide.'
        }
        action={
          tasks.length > 0 && (
            <span className="type-body-sm text-ink-faint tabular-nums">{tasks.length}</span>
          )
        }
      />
      {tasks.length > 0 && (
        <ul className="flex flex-col px-2 pb-2">
          {tasks.map((task) => (
            <li
              key={task.id}
              className="relative flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-sunken/60"
            >
              {task.owner ? (
                <Avatar name={task.owner.fullName} hue={task.owner.avatarHue} size="sm" />
              ) : (
                <StatusGlyph name="review" className="size-4 text-review" />
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <Link
                  href={`/tasks/${task.id}`}
                  className="lt-stretched-link truncate rounded-sm type-body-sm font-medium text-ink"
                >
                  {task.title}
                </Link>
                <ProjectChip project={task.project} showName={false} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** A short trail of what this person finished, for a sense of progress. */
export function RecentlyCompleted({ tasks }: { readonly tasks: readonly TaskSummary[] }) {
  if (tasks.length === 0) return null;
  return (
    <Card tone="sunken">
      <CardHeader title="Recently finished" />
      <ul className="flex flex-col px-2 pb-3">
        {tasks.slice(0, 6).map((task) => (
          <li key={task.id} className="relative flex items-start gap-3 rounded-md px-3 py-2">
            <StatusGlyph name="done" className="mt-0.5 size-4 text-done" />
            <span className="sr-only">Done:</span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <Link
                href={`/tasks/${task.id}`}
                className="lt-stretched-link truncate rounded-sm type-body-sm text-ink-muted"
              >
                {task.title}
              </Link>
              <ProjectChip project={task.project} showName={false} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
