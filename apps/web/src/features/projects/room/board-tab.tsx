'use client';

import type { TaskSummary } from '@lintel/api-contracts';
import {
  cn,
  EmptyState,
  ErrorState,
  Skeleton,
  SkeletonGroup,
  StatusGlyph,
} from '@lintel/design-system/web';
import type { TaskStatus } from '@lintel/domain';
import { pluralize } from '@lintel/shared';
import { LayoutGroup } from 'motion/react';
import { useState } from 'react';
import { useSession } from '@/features/session/session-provider';
import { ReportBlockerSheet } from '@/features/tasks/report-blocker-sheet';
import { TASK_STATUS_PRESENTATION } from '@/features/tasks/task-presentation';
import { describeError } from '@/lib/api/describe-error';
import { todayIn } from '@/lib/format/dates';
import { BoardCard } from './board-card';
import { BoardDragGhost } from './board-drag-ghost';
import { useBoardDrag } from './use-board-drag';
import { legalTargets, useBoardMove } from './use-board-move';
import { useProjectTasks } from './use-project-room';

const COLUMNS: readonly TaskStatus[] = [
  'ready',
  'in_progress',
  'blocked',
  'in_review',
  'changes_requested',
  'done',
];

/** Tasks by status. Dragging shows which columns the task may move to. */
export function BoardTab({ projectId }: { readonly projectId: string }) {
  const { user } = useSession();
  const tasks = useProjectTasks(projectId);
  const move = useBoardMove(projectId);
  const [blocking, setBlocking] = useState<TaskSummary | null>(null);
  const today = todayIn(user.timeZone);

  const requestMove = (task: TaskSummary, to: TaskStatus) => {
    if (task.status === to) return;
    if (to === 'blocked') setBlocking(task);
    else move.mutate({ task, to });
  };
  const { drag, over, start, scroller } = useBoardDrag(requestMove);
  const dragging = drag?.task ?? null;

  if (tasks.isPending) {
    return (
      <SkeletonGroup label="Loading the board" className="flex gap-4">
        {[0, 1, 2, 3].map((column) => (
          <Skeleton key={column} className="h-80 w-72 shrink-0 rounded-lg" />
        ))}
      </SkeletonGroup>
    );
  }
  if (tasks.isError)
    return (
      <ErrorState
        {...describeError(tasks.error, { resource: 'collection' })}
        onRetry={() => tasks.refetch()}
      />
    );
  const items = tasks.data.items.filter((task) => task.status !== 'cancelled');
  if (items.length === 0) {
    return (
      <EmptyState
        drawing="drafting"
        title="No tasks on this project yet"
        description="Tasks from the project's template appear here once the project starts."
      />
    );
  }
  const columns: readonly TaskStatus[] = items.some((task) => task.status === 'draft')
    ? ['draft', ...COLUMNS]
    : COLUMNS;

  return (
    <LayoutGroup>
      <div ref={scroller} className="-mx-5 overflow-x-auto px-5 pb-4 md:-mx-10 md:px-10">
        <div className="flex min-w-max gap-3">
          {columns.map((status) => {
            const presentation = TASK_STATUS_PRESENTATION[status];
            const columnTasks = items.filter((task) => task.status === status);
            const legal = dragging ? legalTargets(dragging.status).includes(status) : false;
            return (
              <section
                key={status}
                data-board-column={status}
                aria-label={`${presentation.label}, ${pluralize(columnTasks.length, 'task')}`}
                className={cn(
                  'flex w-72 shrink-0 flex-col gap-3 rounded-lg border p-3 transition-[background-color,border-color,opacity] duration-(--duration-fast)',
                  'border-transparent bg-sunken/60',
                  dragging && legal && 'border-dashed border-accent/50',
                  dragging && !legal && dragging.status !== status && 'opacity-45',
                  over === status && 'border-accent bg-accent-soft/50',
                )}
              >
                <header className="flex items-center gap-2 px-1">
                  <StatusGlyph name={presentation.glyph} className="size-4 text-ink-muted" />
                  <h2 className="type-title-md text-ink">{presentation.label}</h2>
                  <span className="type-body-sm text-ink-faint tabular-nums">
                    {columnTasks.length}
                  </span>
                </header>
                <ul className="flex min-h-24 flex-col gap-2">
                  {columnTasks.map((task) => (
                    <BoardCard
                      key={task.id}
                      task={task}
                      today={today}
                      dragging={dragging?.id === task.id}
                      onPointerDown={(event) => start(task, event)}
                      onMove={(to) => requestMove(task, to)}
                    />
                  ))}
                  {columnTasks.length === 0 && (
                    <li className="list-none px-1 py-6 text-center type-body-sm text-ink-faint">
                      Nothing here
                    </li>
                  )}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
      <BoardDragGhost drag={drag} />
      <ReportBlockerSheet
        task={
          blocking ? { id: blocking.id, title: blocking.title, version: blocking.version } : null
        }
        onClose={() => setBlocking(null)}
      />
    </LayoutGroup>
  );
}
