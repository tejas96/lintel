'use client';

import { Badge, Button, Checkbox, cn, layoutSpring } from '@lintel/design-system/web';
import { PROJECT_ROLE_LABELS } from '@lintel/domain';
import { ChevronDown, TriangleAlert } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { usePeopleOptions } from '@/features/people/use-people-options';
import { formatCalendarDate } from '@/lib/format/dates';
import type { DraftAdjustment } from './plan-draft';
import type { OutlineTask } from './plan-outline';
import { PlanTaskAdjust } from './plan-task-adjust';

interface PlanTaskRowProps {
  readonly task: OutlineTask;
  readonly today: string;
  readonly expanded: boolean;
  readonly onExpand: (expanded: boolean) => void;
  readonly onInclude: (include: boolean) => void;
  readonly onAdjust: <K extends keyof DraftAdjustment>(
    field: K,
    value: DraftAdjustment[K] | undefined,
  ) => void;
  readonly onDelete: () => void;
  /** Back to the template's suggestion: start, length and person. */
  readonly onReset: () => void;
}

/** Under the title: the planned dates and person, or why it is not in the plan. */
function PlannedLine({
  task,
  today,
  changed,
}: {
  readonly task: OutlineTask;
  readonly today: string;
  readonly changed: boolean;
}) {
  const { people } = usePeopleOptions();
  const planned = task.planned;
  const owner = people.find((person) => person.id === planned?.ownerUserId);
  if (task.removed || !planned) {
    return (
      <span className="type-body-sm text-ink-faint">
        {task.removed ? 'Left out of this project' : 'Dating…'}
      </span>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-x-2 type-body-sm text-ink-faint">
      <span className="tabular-nums">
        {formatCalendarDate(planned.plannedStartDate, today)} –{' '}
        {formatCalendarDate(planned.dueDate, today)}
      </span>
      <span aria-hidden>·</span>
      <span>
        {owner?.fullName ??
          (task.isAdded
            ? 'Nobody yet'
            : `${PROJECT_ROLE_LABELS[task.responsibleRole]}, not chosen`)}
      </span>
      {changed && <Badge variant="soft">Changed</Badge>}
      {planned.overlapsPrerequisite && (
        <span className="inline-flex items-center gap-1 text-at-risk">
          <TriangleAlert aria-hidden className="size-3.5" />
          Starts before what it waits for ends
        </span>
      )}
    </span>
  );
}

/**
 * One task of the plan: included or left out, its dates and person at a
 * glance, and — opened — the start date, length and person to change.
 */
export function PlanTaskRow(props: PlanTaskRowProps) {
  const { task, today, expanded, onExpand, onInclude, onAdjust, onDelete, onReset } = props;
  const changed =
    task.startChanged || task.ownerChanged || task.durationDays !== task.suggestedDurationDays;
  return (
    <motion.li
      layout="position"
      transition={layoutSpring}
      className={cn('rounded-md', expanded && 'bg-surface ring-1 ring-hairline')}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-1 sm:flex-nowrap">
        {task.isAdded ? (
          <span className="flex size-11 shrink-0 items-center justify-center">
            <Badge variant="accent">New</Badge>
          </span>
        ) : (
          <Checkbox
            hideLabel
            label={`Include “${task.title}”`}
            checked={!task.removed}
            disabled={task.stageRemoved}
            onCheckedChange={onInclude}
            className="shrink-0 py-0"
          />
        )}
        <div className={cn('flex min-w-0 flex-1 flex-col', task.removed && 'opacity-55')}>
          <span
            className={cn(
              'truncate type-body text-ink',
              task.removed && 'line-through decoration-ink-faint',
            )}
          >
            {task.title}
          </span>
          <PlannedLine task={task} today={today} changed={changed} />
        </div>
        {!task.removed && (
          <Button
            size="sm"
            variant="quiet"
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Done adjusting' : 'Adjust'} ${task.title}`}
            onClick={() => onExpand(!expanded)}
            className="ml-auto shrink-0"
            trailingIcon={
              <ChevronDown
                aria-hidden
                className={cn(
                  'transition-transform duration-(--duration-base)',
                  expanded && 'rotate-180',
                )}
              />
            }
          >
            {expanded ? 'Done' : 'Adjust'}
          </Button>
        )}
      </div>
      <AnimatePresence initial={false}>
        {expanded && !task.removed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={layoutSpring}
            className="overflow-hidden"
          >
            <PlanTaskAdjust
              task={task}
              today={today}
              changed={changed}
              onAdjust={onAdjust}
              onDelete={onDelete}
              onReset={onReset}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}
