'use client';

import {
  ErrorState,
  pageEnter,
  Skeleton,
  SkeletonGroup,
  SkeletonText,
} from '@lintel/design-system/web';
import { ChevronLeft } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useSession } from '@/features/session/session-provider';
import { describeError } from '@/lib/api/describe-error';
import { todayIn } from '@/lib/format/dates';
import { useTask } from '../use-task';
import { TaskDetailBody } from './task-detail-body';
import { TaskTitleBlock } from './task-header';

export function TaskDetailSkeleton() {
  return (
    <SkeletonGroup label="Loading the task" className="flex flex-col gap-6">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-10 w-3/4" />
      <Skeleton className="h-11 w-72" />
      <SkeletonText lines={4} />
    </SkeletonGroup>
  );
}

/** A task as its own page (direct links, refreshes, sharing). */
export function TaskDetailPage({ taskId }: { readonly taskId: string }) {
  const { user } = useSession();
  const task = useTask(taskId);
  const today = todayIn(user.timeZone);
  return (
    <div className="mx-auto flex w-full max-w-[84rem] flex-col gap-6 px-5 py-6 md:px-10 md:py-9">
      <Link
        href="/today"
        className="inline-flex min-h-11 items-center gap-1 self-start rounded-sm type-body-sm text-ink-muted hover:text-ink"
      >
        <ChevronLeft aria-hidden className="size-4" />
        Today
      </Link>
      {task.isPending && <TaskDetailSkeleton />}
      {task.isError && (
        <ErrorState
          {...describeError(task.error, { resource: 'item', noun: 'task' })}
          onRetry={() => task.refetch()}
          retrying={task.isFetching}
        />
      )}
      {task.data && (
        <motion.article {...pageEnter} className="flex flex-col gap-6">
          <header className="flex flex-col gap-3">
            <TaskTitleBlock task={task.data} />
            <h1 className="max-w-4xl type-display-md text-balance text-ink md:type-display-lg">
              {task.data.title}
            </h1>
          </header>
          <TaskDetailBody task={task.data} today={today} layout="page" />
        </motion.article>
      )}
    </div>
  );
}
