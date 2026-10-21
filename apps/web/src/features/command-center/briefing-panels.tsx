'use client';

import type { CommandCenterBriefing } from '@lintel/api-contracts';
import { Avatar, Card, CardHeader, listItemEnter, PriorityMarker } from '@lintel/design-system/web';
import { BellRing, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { ProjectChip } from '@/features/tasks/task-presentation';
import { formatCalendarDate, withReadableDates } from '@/lib/format/dates';

/** What Lintel has already escalated to the owner and is still open, oldest first. */
export function OwnerInterventions({
  items,
}: {
  readonly items: CommandCenterBriefing['interventions'];
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Owner intervention needed"
        description={
          items.length === 0
            ? 'Nothing has been escalated to you that is still open.'
            : 'Escalated to you and still unresolved, oldest first.'
        }
      />
      {items.length === 0 ? (
        <div className="flex items-center gap-2 px-5 pb-5 type-body-sm text-on-track">
          <CheckCircle2 aria-hidden className="size-4" />
          All clear
        </div>
      ) : (
        <ul className="flex flex-col gap-2 px-3 pb-4">
          {items.map((item, index) => (
            <motion.li
              key={item.subjectId}
              {...listItemEnter(index)}
              className="relative flex gap-3 rounded-md border border-overdue/20 bg-overdue-tint/35 px-3 py-2.5 hover:bg-overdue-tint/60"
            >
              <BellRing aria-hidden className="mt-0.5 size-4 shrink-0 text-overdue" />
              <span className="flex min-w-0 flex-col gap-0.5">
                <Link
                  href={item.linkPath}
                  className="lt-stretched-link rounded-sm type-body-sm font-medium text-ink"
                >
                  {item.task.title}
                </Link>
                <span className="type-body-sm text-ink-muted">
                  {withReadableDates(item.summary)}
                </span>
                <span className="flex flex-wrap items-center gap-x-2 type-body-sm text-ink-faint">
                  <ProjectChip project={item.project} showName={false} />
                  {item.kind === 'blocker_escalated' ? 'Blocked' : 'Overdue'}
                </span>
              </span>
            </motion.li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Open tasks due in the next seven days (today has its own count), soonest first. */
export function DeadlinesAhead({
  deadlines,
  today,
}: {
  readonly deadlines: CommandCenterBriefing['deadlines'];
  readonly today: string;
}) {
  const hidden = deadlines.taskCount - deadlines.tasks.length;
  return (
    <Card>
      <CardHeader
        title="Deadlines in the next 7 days"
        description={`${formatCalendarDate(deadlines.range.start, today)} to ${formatCalendarDate(deadlines.range.end, today)}`}
        action={
          <span className="flex flex-col items-end leading-none">
            <span className="font-display text-[1.75rem] text-ink tabular-nums">
              {deadlines.taskCount}
            </span>
            <span className="mt-1 type-body-sm text-ink-faint">
              {deadlines.milestoneCount === 1
                ? '1 milestone'
                : `${deadlines.milestoneCount} milestones`}
            </span>
          </span>
        }
      />
      {deadlines.tasks.length === 0 ? (
        <p className="px-5 pb-5 type-body-sm text-ink-faint">Nothing is due in the coming week.</p>
      ) : (
        <ul className="flex flex-col px-2 pb-3">
          {deadlines.tasks.map((task) => (
            <li
              key={task.id}
              className="relative grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-0.5 rounded-md px-3 py-2 hover:bg-sunken/60"
            >
              <span className="row-span-2 font-mono text-[0.75rem] text-ink-muted">
                {task.dueDate ? formatCalendarDate(task.dueDate, today) : ''}
              </span>
              <Link
                href={`/tasks/${task.id}`}
                className="lt-stretched-link truncate rounded-sm type-body-sm text-ink"
              >
                {task.title}
              </Link>
              <span className="flex min-w-0 items-center gap-2">
                <PriorityMarker priority={task.priority} />
                <ProjectChip project={task.project} showName={false} />
                {task.owner && (
                  <span className="truncate type-body-sm text-ink-faint">
                    {task.owner.fullName}
                  </span>
                )}
              </span>
            </li>
          ))}
          {hidden > 0 && (
            <li className="px-3 pt-1 type-body-sm text-ink-faint">
              and {hidden} more in the same week
            </li>
          )}
        </ul>
      )}
    </Card>
  );
}

/** People who delivered milestones on time in the period. */
export function PerformanceHighlights({
  highlights,
  today,
}: {
  readonly highlights: CommandCenterBriefing['highlights'];
  readonly today: string;
}) {
  return (
    <Card>
      <CardHeader
        title="Highlights"
        description={
          highlights.length === 0
            ? 'No milestone was delivered on time in this period yet.'
            : 'Milestones delivered on time in this period, by the people who did the work.'
        }
      />
      {highlights.length > 0 && (
        <ul className="flex flex-col gap-3 px-5 pb-5">
          {highlights.map(({ user, milestones }) => (
            <li key={user.id} className="flex gap-3">
              <Avatar name={user.fullName} hue={user.avatarHue} size="sm" decorative />
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="type-body-sm text-ink">
                  <span className="font-medium">{user.fullName}</span>
                  <span className="text-ink-muted">
                    {' '}
                    · {milestones.length} {milestones.length === 1 ? 'milestone' : 'milestones'} on
                    time
                  </span>
                </p>
                <p className="truncate type-body-sm text-ink-faint">
                  {milestones
                    .slice(0, 2)
                    .map((item) => `${item.name}, ${formatCalendarDate(item.completedOn, today)}`)
                    .join(' · ')}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
