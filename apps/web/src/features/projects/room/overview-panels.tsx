'use client';

import type { ProjectDetail, ProjectMember, TaskSummary } from '@lintel/api-contracts';
import { Avatar, Card, CardHeader, easing, SkeletonText, seconds } from '@lintel/design-system/web';
import { PROJECT_ROLE_LABELS } from '@lintel/domain';
import { CircleAlert, TriangleAlert } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { TaskNumber, TaskStatusPill } from '@/features/tasks/task-presentation';
import { formatCalendarDate, formatRelativeInstant } from '@/lib/format/dates';
import { describeTaskDue } from '@/lib/format/task-due';
import { useOpenBlockers } from './use-project-room';

export function UpcomingDeadlines({
  tasks,
  today,
}: {
  readonly tasks: readonly TaskSummary[];
  readonly today: string;
}) {
  if (tasks.length === 0)
    return (
      <p className="px-3 pb-2 type-body-sm text-ink-faint">Nothing is due in the next two weeks.</p>
    );
  return (
    <ul className="flex flex-col">
      {tasks.slice(0, 10).map((task) => {
        const due = describeTaskDue(task, today);
        return (
          <li
            key={task.id}
            className="relative flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-sunken/60"
          >
            <TaskNumber value={task.number} />
            <Link
              href={`/tasks/${task.id}`}
              className="lt-stretched-link min-w-0 flex-1 truncate rounded-sm type-body-sm text-ink"
            >
              {task.title}
            </Link>
            {task.owner && (
              <Avatar name={task.owner.fullName} hue={task.owner.avatarHue} size="xs" />
            )}
            {due && (
              <span
                className={
                  due.late ? 'type-body-sm font-medium text-overdue' : 'type-body-sm text-ink-muted'
                }
              >
                {due.text}
              </span>
            )}
            <TaskStatusPill status={task.status} />
          </li>
        );
      })}
    </ul>
  );
}

/** Health reasons and milestones at risk, in the server's words. */
export function OverviewRisks({
  project,
  today,
}: {
  readonly project: ProjectDetail;
  readonly today: string;
}) {
  const risky = project.milestones.filter(
    (milestone) => milestone.health === 'at_risk' || milestone.health === 'missed',
  );
  return (
    <Card>
      <CardHeader
        title="Risks"
        description={
          risky.length === 0 && project.health.reasons.length === 0
            ? 'Nothing is threatening the dates.'
            : undefined
        }
      />
      {(risky.length > 0 || project.health.reasons.length > 0) && (
        <ul className="flex flex-col gap-3 px-5 pb-5">
          {project.health.reasons.map((reason) => (
            <li key={reason.message} className="flex items-start gap-2 type-body-sm text-ink">
              {reason.severity === 'critical' ? (
                <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-overdue" />
              ) : (
                <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-at-risk" />
              )}
              {reason.message}
            </li>
          ))}
          {risky.map((milestone) => (
            <li key={milestone.id} className="flex flex-col gap-0.5 border-t border-hairline pt-3">
              <span className="type-body-sm font-medium text-ink">
                {milestone.name}, {formatCalendarDate(milestone.dueDate, today)}
                <span className={milestone.health === 'missed' ? 'text-overdue' : 'text-at-risk'}>
                  {milestone.health === 'missed' ? ' (missed)' : ' (at risk)'}
                </span>
              </span>
              {milestone.riskReasons.map((reason) => (
                <span key={reason} className="type-body-sm text-ink-muted">
                  {reason}
                </span>
              ))}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function OverviewBlockers({ projectId }: { readonly projectId: string }) {
  const blockers = useOpenBlockers(projectId);
  const items = blockers.data ?? [];
  return (
    <Card>
      <CardHeader
        title="Open blockers"
        description={blockers.data && items.length === 0 ? 'Nothing is stuck.' : undefined}
      />
      {blockers.isPending && <SkeletonText lines={2} className="px-5 pb-5" />}
      {items.length > 0 && (
        <ul className="flex flex-col gap-3 px-5 pb-5">
          {items.map((blocker) => (
            <li
              key={blocker.id}
              className="relative flex flex-col gap-0.5 rounded-md border border-blocked/25 bg-blocked-tint/40 p-3"
            >
              <Link
                href={`/tasks/${blocker.taskId}`}
                className="lt-stretched-link rounded-sm type-body-sm font-medium text-ink"
              >
                {blocker.reason}
              </Link>
              <span className="type-body-sm text-ink-muted">
                {blocker.waitingOn ? `Waiting on ${blocker.waitingOn.fullName}, ` : ''}raised{' '}
                {formatRelativeInstant(blocker.raisedAt)} by {blocker.raisedBy.fullName}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Who is on the project and how much open work each of them holds here. */
export function TeamAllocation({
  members,
  openTasks,
}: {
  readonly members: readonly ProjectMember[];
  readonly openTasks: readonly TaskSummary[];
}) {
  const counts = new Map<string, number>();
  for (const task of openTasks)
    if (task.owner) counts.set(task.owner.id, (counts.get(task.owner.id) ?? 0) + 1);
  const largest = Math.max(1, ...counts.values());
  const people = [...new Map(members.map((member) => [member.user.id, member])).values()];
  return (
    <Card>
      <CardHeader
        title="Team"
        description={`${people.length} ${people.length === 1 ? 'person' : 'people'} on this project`}
      />
      <ul className="flex flex-col gap-3 px-5 pb-5">
        {people.map((member, index) => {
          const open = counts.get(member.user.id) ?? 0;
          return (
            <li key={member.user.id} className="flex items-center gap-3">
              <Avatar
                name={member.user.fullName}
                hue={member.user.avatarHue}
                size="sm"
                decorative
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="flex items-baseline justify-between gap-2 type-body-sm">
                  <span className="truncate text-ink">{member.user.fullName}</span>
                  <span className="shrink-0 text-ink-faint tabular-nums">{open} open</span>
                </p>
                <p className="type-body-sm text-ink-faint">
                  {PROJECT_ROLE_LABELS[member.projectRole]}
                </p>
                <span aria-hidden className="block h-1 overflow-hidden rounded-full bg-sunken">
                  <motion.span
                    className="block h-full origin-left rounded-full bg-ink-faint"
                    style={{ width: `${(open / largest) * 100}%` }}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{
                      duration: seconds('data'),
                      ease: easing('outExpo'),
                      delay: index * 0.04,
                    }}
                  />
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
