'use client';

import type { TaskSummary } from '@lintel/api-contracts';
import { Avatar, cn, IconButton, layoutSpring, PriorityMarker } from '@lintel/design-system/web';
import type { TaskStatus } from '@lintel/domain';
import { ArrowRightLeft, ListChecks } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { DropdownMenu } from 'radix-ui';
import type { PointerEvent } from 'react';
import { TASK_STATUS_PRESENTATION, TaskNumber } from '@/features/tasks/task-presentation';
import { describeDue } from '@/lib/format/dates';
import { legalTargets } from './use-board-move';

interface BoardCardProps {
  readonly task: TaskSummary;
  readonly today: string;
  readonly dragging: boolean;
  /** Starts a pointer drag (mouse or pen); touch and keyboard use "Move to". */
  readonly onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  readonly onMove: (to: TaskStatus) => void;
}

/** A task card: drag it to a column, or use "Move to" from the keyboard or a phone. */
export function BoardCard({ task, today, dragging, onPointerDown, onMove }: BoardCardProps) {
  const due = task.dueDate ? describeDue(task.dueDate, today) : null;
  return (
    <motion.li
      layout
      layoutId={`board-${task.id}`}
      transition={layoutSpring}
      className={cn(
        'group relative list-none rounded-md border border-hairline bg-raised p-3 shadow-e1 transition-[opacity,box-shadow]',
        'hover:shadow-e2',
        dragging && 'border-dashed opacity-40 shadow-none',
      )}
    >
      {/* Pointer dragging is an enhancement; the "Move to" menu is the keyboard and touch path. */}
      <div
        onPointerDown={onPointerDown}
        // The browser's own link dragging would cancel the pointer drag.
        onDragStart={(event) => event.preventDefault()}
        className="flex cursor-grab select-none flex-col gap-2 active:cursor-grabbing"
      >
        <div className="flex items-start gap-2">
          <Link
            href={`/tasks/${task.id}`}
            className="lt-stretched-link min-w-0 flex-1 rounded-sm type-body-sm font-medium text-ink"
          >
            {task.title}
          </Link>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <IconButton
                label={`Move “${task.title}” to another column`}
                size="sm"
                className="relative z-[1] -mt-1 -mr-1"
              >
                <ArrowRightLeft aria-hidden />
              </IconButton>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={4}
                className="lt-pop z-50 min-w-48 rounded-lg border border-hairline bg-raised p-1 shadow-e3"
              >
                <DropdownMenu.Label className="px-2.5 py-1.5 type-label text-ink-faint">
                  Move to
                </DropdownMenu.Label>
                {legalTargets(task.status).map((status) => (
                  <DropdownMenu.Item
                    key={status}
                    onSelect={() => onMove(status)}
                    className="flex min-h-10 cursor-pointer items-center rounded-sm px-2.5 type-body-sm text-ink outline-none data-highlighted:bg-sunken"
                  >
                    {TASK_STATUS_PRESENTATION[status].label}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <TaskNumber value={task.number} />
          {due && (
            <span
              className={cn(
                'type-body-sm',
                due.late ? 'font-medium text-overdue' : 'text-ink-faint',
              )}
            >
              {due.text}
            </span>
          )}
          {task.checklist.total > 0 && (
            <span className="inline-flex items-center gap-1 type-body-sm text-ink-faint tabular-nums">
              <ListChecks aria-hidden className="size-3.5" />
              {task.checklist.done}/{task.checklist.total}
            </span>
          )}
          <span className="ml-auto flex items-center gap-2">
            <PriorityMarker priority={task.priority} showLabel={false} />
            {task.owner && (
              <Avatar name={task.owner.fullName} hue={task.owner.avatarHue} size="xs" />
            )}
          </span>
        </div>
      </div>
    </motion.li>
  );
}
