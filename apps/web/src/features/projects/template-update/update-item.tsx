'use client';

import type { TemplateUpdateItem } from '@lintel/api-contracts';
import { Avatar, Checkbox, cn } from '@lintel/design-system/web';
import { TASK_STATUSES, type TaskStatus } from '@lintel/domain';
import { Ban } from 'lucide-react';
import { TaskStatusPill } from '@/features/tasks/task-presentation';
import { formatCalendarDate } from '@/lib/format/dates';
import { ChangeMark } from './change-mark';
import { FieldChanges } from './field-changes';

const KIND_WORDS = { stage: 'Stage', milestone: 'Milestone', task: 'Task' } as const;

function isTaskStatus(value: string | null): value is TaskStatus {
  return value !== null && (TASK_STATUSES as readonly string[]).includes(value);
}

/** What happens to an added task: when it runs and who owns it. */
function AddedSchedule({
  item,
  today,
}: {
  readonly item: TemplateUpdateItem;
  readonly today: string;
}) {
  if (!item.schedule) return null;
  const { owner } = item.schedule;
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 type-body-sm text-ink-muted">
      <span className="tabular-nums">
        {item.schedule.plannedStartDate === item.schedule.dueDate
          ? formatCalendarDate(item.schedule.dueDate, today)
          : `${formatCalendarDate(item.schedule.plannedStartDate, today)} to ${formatCalendarDate(item.schedule.dueDate, today)}`}
      </span>
      <span aria-hidden>·</span>
      {owner ? (
        <span className="inline-flex items-center gap-1.5">
          <Avatar name={owner.fullName} hue={owner.avatarHue} size="xs" decorative />
          {owner.fullName}
        </span>
      ) : (
        <span className="text-ink-faint">Nobody holds the role yet; it starts as a draft</span>
      )}
    </p>
  );
}

const STARTED = new Set(['in_progress', 'blocked', 'in_review', 'changes_requested']);

/** What the tick does, in the manager's words. */
function optInLabel(item: TemplateUpdateItem): string {
  if (item.change === 'removed') return 'Cancel it anyway';
  if (item.kind === 'task' && item.status && STARTED.has(item.status)) {
    return 'Update it although work has started';
  }
  if (item.kind === 'stage') return 'Update it although the stage has started';
  return 'Move the committed dates too';
}

function removalWords(item: TemplateUpdateItem): string | null {
  if (item.change !== 'removed' || item.blocked) return null;
  if (item.kind === 'task')
    return item.willApply ? 'Will be cancelled (kept in the record).' : null;
  if (item.kind === 'milestone') return 'Will be cancelled.';
  return 'Will be skipped once none of its tasks are left open.';
}

/**
 * One stage, milestone or task in the update: what it is, what happens to
 * it, and, when the change is held back, the tick that lets it through.
 */
export function UpdateItem({
  item,
  today,
  ticked,
  onTick,
}: {
  readonly item: TemplateUpdateItem;
  readonly today: string;
  /** The manager's tick, kept on the page so it answers at once. */
  readonly ticked: boolean;
  readonly onTick: (key: string, ticked: boolean) => void;
}) {
  const status = isTaskStatus(item.status) ? item.status : null;
  const removal = removalWords(item);
  return (
    <li className={cn('flex flex-col gap-3 px-4 py-3.5', item.blocked && 'bg-sunken/40')}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="flex flex-wrap items-center gap-2 type-overline text-ink-faint">
            {KIND_WORDS[item.kind]}
            {item.kind !== 'stage' && item.stageName ? ` · ${item.stageName}` : ''}
            {item.blocked && (
              <ChangeMark kind={item.change} className="h-5 normal-case tracking-normal" />
            )}
          </p>
          <p
            className={cn(
              'type-body font-medium text-ink',
              item.change === 'removed' && item.willApply && 'line-through decoration-overdue/50',
            )}
          >
            {item.name}
          </p>
        </div>
        {status && status !== 'ready' && status !== 'draft' && <TaskStatusPill status={status} />}
      </div>
      {item.change === 'added' && <AddedSchedule item={item} today={today} />}
      {removal && <p className="type-body-sm text-ink-muted">{removal}</p>}
      <FieldChanges item={item} today={today} ticked={ticked} />
      {item.blocked && (
        <p className="flex items-start gap-2 type-body-sm text-ink-muted">
          <Ban aria-hidden className="mt-0.5 size-3.5 shrink-0 text-ink-faint" />
          {item.blocked.reason}
        </p>
      )}
      {item.optIn && !item.blocked && (
        <Checkbox
          checked={ticked}
          onCheckedChange={(checked) => onTick(item.key, checked)}
          label={optInLabel(item)}
          description={item.optIn.reason}
        />
      )}
    </li>
  );
}
