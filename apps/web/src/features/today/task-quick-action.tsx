'use client';

import type { TaskSummary } from '@lintel/api-contracts';
import { Button, IconButton } from '@lintel/design-system/web';
import {
  Check,
  Ellipsis,
  Hand,
  OctagonPause,
  Play,
  Send,
  SquareArrowOutUpRight,
} from 'lucide-react';
import Link from 'next/link';
import { DropdownMenu } from 'radix-ui';
import type { ReactNode } from 'react';
import { useTaskActions } from '@/features/tasks/use-task-actions';
import { useWorkTracking } from '@/features/tasks/work-tracking';

interface QuickActionProps {
  readonly task: TaskSummary;
  /** Called before a change this person makes, so the list may reorder. */
  readonly onBeforeChange: () => void;
  readonly onReportBlocker: (task: TaskSummary) => void;
}

/** The one obvious next step for a task, chosen from its status. */
export function TaskQuickAction({ task, onBeforeChange, onReportBlocker }: QuickActionProps) {
  const actions = useTaskActions();
  const tracking = useWorkTracking();
  const finishTo = task.requiresReview ? 'in_review' : 'done';
  const pending =
    (actions.startWork.isPending && actions.startWork.variables === task.id) ||
    (actions.acknowledge.isPending && actions.acknowledge.variables === task.id) ||
    (actions.transition.isPending && actions.transition.variables?.taskId === task.id);

  let primary: { label: string; icon: ReactNode; run: () => void } | null = null;
  if (task.needsAcknowledgement) {
    primary = {
      label: 'Acknowledge',
      icon: <Hand aria-hidden />,
      run: () => actions.acknowledge.mutate(task.id),
    };
  } else if (task.status === 'ready' || task.status === 'changes_requested') {
    primary = {
      label: 'Start',
      icon: <Play aria-hidden />,
      // Without time tracking, starting is a plain status move.
      run: tracking
        ? () => actions.startWork.mutate(task.id)
        : () =>
            actions.transition.mutate({
              taskId: task.id,
              to: 'in_progress',
              note: null,
              version: task.version,
            }),
    };
  } else if (task.status === 'in_progress') {
    primary = {
      label: task.requiresReview ? 'Submit' : 'Done',
      icon: task.requiresReview ? <Send aria-hidden /> : <Check aria-hidden />,
      run: () =>
        actions.transition.mutate({
          taskId: task.id,
          to: finishTo,
          note: null,
          version: task.version,
        }),
    };
  }

  return (
    <div className="relative z-[1] flex shrink-0 items-center gap-1">
      {primary && (
        <Button
          size="sm"
          variant="secondary"
          pending={pending}
          leadingIcon={primary.icon}
          onClick={() => {
            onBeforeChange();
            primary?.run();
          }}
          aria-label={`${primary.label}: ${task.title}`}
        >
          {primary.label}
        </Button>
      )}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <IconButton label={`More actions for ${task.title}`} size="sm">
            <Ellipsis aria-hidden />
          </IconButton>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            className="lt-pop z-50 min-w-52 rounded-lg border border-hairline bg-raised p-1 shadow-e3"
          >
            <MenuItem
              asLink
              href={`/tasks/${task.id}`}
              icon={<SquareArrowOutUpRight aria-hidden />}
            >
              Open task
            </MenuItem>
            {task.status !== 'blocked' && task.status !== 'done' && (
              <MenuItem icon={<OctagonPause aria-hidden />} onSelect={() => onReportBlocker(task)}>
                Report a blocker
              </MenuItem>
            )}
            {task.status === 'in_progress' && tracking && (
              <MenuItem
                icon={<OctagonPause aria-hidden />}
                onSelect={() => {
                  onBeforeChange();
                  actions.pauseWork.mutate(task.id);
                }}
              >
                Pause work
              </MenuItem>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}

const ITEM_CLASS =
  'flex min-h-10 cursor-pointer items-center gap-2.5 rounded-sm px-2.5 type-body-sm text-ink outline-none data-highlighted:bg-sunken [&_svg]:size-4 [&_svg]:text-ink-faint';

function MenuItem({
  children,
  icon,
  onSelect,
  asLink,
  href,
}: {
  readonly children: ReactNode;
  readonly icon: ReactNode;
  readonly onSelect?: () => void;
  readonly asLink?: boolean;
  readonly href?: string;
}) {
  if (asLink && href) {
    return (
      <DropdownMenu.Item asChild className={ITEM_CLASS}>
        <Link href={href}>
          {icon}
          {children}
        </Link>
      </DropdownMenu.Item>
    );
  }
  return (
    <DropdownMenu.Item className={ITEM_CLASS} onSelect={onSelect}>
      {icon}
      {children}
    </DropdownMenu.Item>
  );
}
