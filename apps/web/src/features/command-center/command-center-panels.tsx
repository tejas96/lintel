'use client';

import type { CommandCenter } from '@lintel/api-contracts';
import {
  Avatar,
  AvatarStack,
  Card,
  CardHeader,
  LOAD_LABELS,
  StatusPill,
} from '@lintel/design-system/web';
import { pluralize } from '@lintel/shared';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { ProjectChip } from '@/features/tasks/task-presentation';
import { formatCalendarDate, formatRelativeInstant } from '@/lib/format/dates';
import { describeTaskDue } from '@/lib/format/task-due';

const MILESTONE_HEALTH = {
  completed: { tone: 'done', glyph: 'done', label: 'Completed' },
  on_track: { tone: 'onTrack', glyph: 'onTrack', label: 'On track' },
  at_risk: { tone: 'atRisk', glyph: 'atRisk', label: 'At risk' },
  missed: { tone: 'overdue', glyph: 'overdue', label: 'Missed' },
} as const;

export function UpcomingMilestones({
  data,
  today,
  filtered = false,
}: {
  readonly data: CommandCenter;
  readonly today: string;
  /** Narrowed to some projects, people or a team: the wording says so. */
  readonly filtered?: boolean;
}) {
  return (
    <Card>
      <CardHeader
        title="Milestones ahead"
        description={
          filtered
            ? 'Across the open projects in this view, soonest first.'
            : 'Across every open project, soonest first.'
        }
      />
      {data.upcomingMilestones.length === 0 ? (
        <p className="px-5 pb-5 type-body-sm text-ink-faint">No milestones in the coming weeks.</p>
      ) : (
        <ul className="flex flex-col px-2 pb-3">
          {data.upcomingMilestones.slice(0, 8).map(({ milestone, project }) => {
            const health = MILESTONE_HEALTH[milestone.health];
            return (
              <li
                key={milestone.id}
                className="relative flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-3 py-2.5 hover:bg-sunken/60"
              >
                <span className="w-14 shrink-0 font-mono text-[0.75rem] text-ink-muted">
                  {formatCalendarDate(milestone.dueDate, today)}
                </span>
                <Link
                  href={`/projects/${project.id}`}
                  className="lt-stretched-link min-w-0 flex-1 truncate rounded-sm type-body-sm text-ink"
                >
                  {milestone.name}
                </Link>
                <ProjectChip project={project} showName={false} />
                <StatusPill
                  tone={health.tone}
                  glyph={health.glyph}
                  label={health.label}
                  size="sm"
                />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/** Decisions only the owner or a manager can make, with where to make them. */
export function DecisionsWaiting({ data }: { readonly data: CommandCenter }) {
  const rows = [
    { label: 'Approvals in your inbox', count: data.approvals.length, href: '/approvals' },
    {
      label: 'Scope changes to decide',
      count: data.scopeChangesAwaitingDecision.length,
      href: '/approvals',
    },
    {
      label: 'Leave requests to decide',
      count: data.leaveAwaitingDecision.length,
      href: '/approvals',
    },
  ];
  return (
    <Card>
      <CardHeader title="Waiting on decisions" />
      <ul className="flex flex-col px-2 pb-3">
        {rows.map((row) => (
          <li
            key={row.label}
            className="relative flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-sunken/60"
          >
            <span className="font-display text-[1.375rem] leading-none text-ink tabular-nums">
              {row.count}
            </span>
            <Link
              href={row.href}
              className="lt-stretched-link flex-1 rounded-sm type-body-sm text-ink-muted"
            >
              {row.label}
            </Link>
            <ChevronRight aria-hidden className="size-4 text-ink-faint" />
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function StuckWork({
  data,
  today,
}: {
  readonly data: CommandCenter;
  readonly today: string;
}) {
  const critical = data.criticalToday;
  return (
    <Card>
      <CardHeader
        title="Stuck or due today"
        description={
          data.blockers.length + critical.length === 0
            ? 'Nothing stuck, nothing critical due today.'
            : undefined
        }
      />
      {(data.blockers.length > 0 || critical.length > 0) && (
        <ul className="flex flex-col gap-2 px-5 pb-5">
          {data.blockers.slice(0, 5).map((blocker) => (
            <li
              key={blocker.id}
              className="relative flex flex-col gap-0.5 rounded-md border border-blocked/25 bg-blocked-tint/40 p-3"
            >
              <Link
                href={`/tasks/${blocker.task.id}`}
                className="lt-stretched-link rounded-sm type-body-sm font-medium text-ink"
              >
                {blocker.task.title}
              </Link>
              <span className="type-body-sm text-ink-muted">
                Blocked {formatRelativeInstant(blocker.raisedAt)}: {blocker.reason}
              </span>
            </li>
          ))}
          {critical.slice(0, 5).map((task) => (
            <li
              key={task.id}
              className="relative flex items-center gap-3 rounded-md border border-hairline p-3"
            >
              <Link
                href={`/tasks/${task.id}`}
                className="lt-stretched-link min-w-0 flex-1 truncate rounded-sm type-body-sm text-ink"
              >
                {task.title}
              </Link>
              {task.dueDate && (
                <span className="type-body-sm text-overdue">
                  {describeTaskDue(task, today)?.text}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Who is overloaded (load ring around the avatar) and who is away today. */
export function TeamPulse({ data }: { readonly data: CommandCenter }) {
  const { team } = data;
  return (
    <Card>
      <CardHeader
        title="Team today"
        description={`${team.availableToday} of ${pluralize(team.headcount, 'person', 'people')} available`}
      />
      <div className="flex flex-col gap-4 px-5 pb-5">
        {team.overloaded.length === 0 ? (
          <p className="type-body-sm text-ink-faint">
            Nobody is booked beyond their time this week.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {team.overloaded.map(({ user, utilization }) => (
              <li key={user.id} className="flex items-center gap-3">
                <Avatar
                  name={user.fullName}
                  hue={user.avatarHue}
                  size="md"
                  load={{ utilization, status: 'overloaded' }}
                />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate type-body-sm font-medium text-ink">
                    {user.fullName}
                  </span>
                  <span className="type-body-sm text-overdue">
                    {LOAD_LABELS.overloaded}, {Math.round(utilization * 100)}% booked
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
        {team.onLeaveToday.length > 0 && (
          <div className="flex items-center gap-3 border-t border-hairline pt-4">
            <AvatarStack people={team.onLeaveToday} max={5} size="xs" />
            <span className="type-body-sm text-ink-muted">On leave today</span>
          </div>
        )}
      </div>
    </Card>
  );
}
