'use client';

import type { TaskSummary } from '@lintel/api-contracts';
import { cn, layoutSpring, PriorityMarker, StatusGlyph } from '@lintel/design-system/web';
import { ListChecks } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import {
  ProjectChip,
  TASK_STATUS_PRESENTATION,
  TaskStatusPill,
} from '@/features/tasks/task-presentation';
import { describeDue } from '@/lib/format/dates';
import { TaskQuickAction } from './task-quick-action';

const NOTABLE_STATUSES = new Set(['blocked', 'in_review', 'changes_requested']);

const GLYPH_TONE: Readonly<Record<string, string>> = {
  neutral: 'text-ink-faint',
  blocked: 'text-blocked',
  review: 'text-review',
  atRisk: 'text-at-risk',
  done: 'text-done',
};

interface TaskRowProps {
  readonly task: TaskSummary;
  readonly today: string;
  /** Optional reason the server gave for this task's position. */
  readonly headline?: string;
  readonly onBeforeChange: () => void;
  readonly onReportBlocker: (task: TaskSummary) => void;
  readonly showActions?: boolean;
}

/** One task: what, where, when, and the next step, in a single calm line. */
export function TaskRow({
  task,
  today,
  headline,
  onBeforeChange,
  onReportBlocker,
  showActions = true,
}: TaskRowProps) {
  const status = TASK_STATUS_PRESENTATION[task.status];
  const due = task.dueDate ? describeDue(task.dueDate, today) : null;
  return (
    <motion.li
      layout="position"
      transition={layoutSpring}
      className="group relative flex flex-wrap items-start gap-x-3 gap-y-2 rounded-md px-3 py-3 transition-colors hover:bg-sunken/50 sm:flex-nowrap sm:items-center"
    >
      <span
        title={status.label}
        className={cn('mt-0.5 sm:mt-0', GLYPH_TONE[status.tone] ?? 'text-ink-faint')}
      >
        <StatusGlyph name={status.glyph} className="size-4" />
        <span className="sr-only">{status.label}</span>
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Link
          href={`/tasks/${task.id}`}
          className="lt-stretched-link line-clamp-2 rounded-sm type-body font-medium text-ink outline-offset-4 sm:truncate"
        >
          {task.title}
        </Link>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {due && (
            <span
              className={cn(
                'type-body-sm tabular-nums sm:hidden',
                due.late ? 'font-medium text-overdue' : due.soon ? 'text-ink' : 'text-ink-faint',
              )}
            >
              {due.text}
            </span>
          )}
          <ProjectChip project={task.project} />
          {task.stage && (
            <span className="hidden type-body-sm text-ink-faint sm:inline">{task.stage.name}</span>
          )}
          {task.checklist.total > 0 && (
            <span className="inline-flex items-center gap-1 type-body-sm text-ink-faint tabular-nums">
              <ListChecks aria-hidden className="size-3.5" />
              <span className="sr-only">Checklist</span>
              {task.checklist.done}/{task.checklist.total}
            </span>
          )}
          {headline && <span className="type-body-sm text-ink-faint italic">{headline}</span>}
        </div>
      </div>
      <div className="flex w-full items-center justify-end gap-3 pl-7 sm:w-auto sm:shrink-0 sm:gap-4 sm:pl-0">
        {NOTABLE_STATUSES.has(task.status) && (
          <span className="mr-auto sm:mr-0">
            <TaskStatusPill status={task.status} />
          </span>
        )}
        {due && (
          <span
            className={cn(
              'hidden type-body-sm whitespace-nowrap tabular-nums sm:inline',
              due.late ? 'font-medium text-overdue' : due.soon ? 'text-ink' : 'text-ink-faint',
            )}
          >
            {due.text}
          </span>
        )}
        <PriorityMarker
          priority={task.priority}
          showLabel={false}
          className="hidden lg:inline-flex"
        />
        {showActions && (
          <TaskQuickAction
            task={task}
            onBeforeChange={onBeforeChange}
            onReportBlocker={onReportBlocker}
          />
        )}
      </div>
    </motion.li>
  );
}
