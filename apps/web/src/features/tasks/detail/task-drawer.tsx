'use client';

import { ErrorState, Sheet } from '@lintel/design-system/web';
import { Maximize2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useSession } from '@/features/session/session-provider';
import { describeError } from '@/lib/api/describe-error';
import { todayIn } from '@/lib/format/dates';
import { useTask } from '../use-task';
import { TaskDetailBody } from './task-detail-body';
import { TaskDetailSkeleton } from './task-detail-page';
import { TaskTitleBlock } from './task-header';

/**
 * A task opened over the page it was clicked from. Closing slides it away,
 * then returns to that page; the URL is the task's own, so it can be shared.
 */
export function TaskDrawer({ taskId }: { readonly taskId: string }) {
  const router = useRouter();
  const { user } = useSession();
  const [open, setOpen] = useState(true);
  const task = useTask(taskId);
  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      onExitComplete={() => router.back()}
      width="lg"
      title={task.data?.title ?? 'Task'}
      header={
        <div className="flex flex-wrap items-center justify-between gap-2">
          {task.data && <TaskTitleBlock task={task.data} />}
          <a
            href={`/tasks/${taskId}`}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-sm type-body-sm text-ink-muted hover:text-ink"
          >
            <Maximize2 aria-hidden className="size-3.5" />
            Open as page
          </a>
        </div>
      }
    >
      {task.isPending && (
        <div className="p-6">
          <TaskDetailSkeleton />
        </div>
      )}
      {task.isError && (
        <ErrorState
          size="section"
          {...describeError(task.error, { resource: 'item', noun: 'task' })}
          onRetry={() => task.refetch()}
        />
      )}
      {task.data && (
        <TaskDetailBody task={task.data} today={todayIn(user.timeZone)} layout="drawer" />
      )}
    </Sheet>
  );
}
