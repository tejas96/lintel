'use client';

import type { ProjectSummary } from '@lintel/api-contracts';
import { Avatar, cn, listItemEnter, StageTracker } from '@lintel/design-system/web';
import { PROJECT_TYPE_LABELS } from '@lintel/domain';
import { motion } from 'motion/react';
import Link from 'next/link';
import { swatchClass } from '@/features/tasks/task-presentation';
import { daysBetween, formatCalendarDate } from '@/lib/format/dates';
import { HealthPill, PROJECT_STATUS_LABELS, stagesFromSummary } from './project-presentation';

function EndDate({ project, today }: { readonly project: ProjectSummary; readonly today: string }) {
  const forecast = project.health.forecastEndDate;
  const slip = forecast ? daysBetween(project.plannedEndDate, forecast) : 0;
  const moved = project.plannedEndDate !== project.baselineEndDate;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="type-body-sm text-ink-faint">Ends</span>
      <span className="type-body-sm text-ink">
        {formatCalendarDate(project.plannedEndDate, today)}
      </span>
      {slip > 0 && forecast && (
        <span className="type-body-sm text-at-risk">
          Forecast {formatCalendarDate(forecast, today)}, {slip} {slip === 1 ? 'day' : 'days'} late
        </span>
      )}
      {slip <= 0 && moved && (
        <span className="type-body-sm text-ink-faint">
          Planned {formatCalendarDate(project.baselineEndDate, today)} at start
        </span>
      )}
    </div>
  );
}

/** A project at a glance: identity, health with reasons, stage, next milestone and dates. */
export function ProjectCard({
  project,
  today,
  index,
}: {
  readonly project: ProjectSummary;
  readonly today: string;
  readonly index: number;
}) {
  const firstReason =
    project.health.reasons.find((reason) => reason.severity === 'critical') ??
    project.health.reasons[0];
  return (
    <motion.li
      {...listItemEnter(index)}
      className="group relative flex flex-col overflow-hidden rounded-lg border border-hairline bg-raised transition-[box-shadow,border-color] duration-(--duration-base) hover:border-rule hover:shadow-e2"
    >
      <span aria-hidden className={cn('h-1 w-full', swatchClass(project.colorIndex))} />
      <div className="flex flex-1 flex-col gap-5 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="flex flex-wrap items-baseline gap-x-2 type-body-sm text-ink-faint">
              <span className="font-mono text-[0.75rem]">{project.reference}</span>
              {PROJECT_TYPE_LABELS[project.projectType]}
            </span>
            <h2 className="type-title-lg text-ink">
              <Link href={`/projects/${project.id}`} className="lt-stretched-link rounded-sm">
                {project.name}
              </Link>
            </h2>
            <p className="truncate type-body-sm text-ink-muted">{project.clientName}</p>
          </div>
          <div className="relative z-[1] flex shrink-0 flex-col items-end gap-1.5">
            <HealthPill health={project.health} />
            {project.status !== 'active' && (
              <span className="type-body-sm text-ink-faint">
                {PROJECT_STATUS_LABELS[project.status]}
              </span>
            )}
          </div>
        </div>
        {firstReason && <p className="-mt-2 type-body-sm text-ink-muted">{firstReason.message}</p>}
        {project.currentStage ? (
          <StageTracker stages={stagesFromSummary(project)} />
        ) : (
          <p className="type-body-sm text-ink-faint">No workflow stages yet.</p>
        )}
        <div className="mt-auto grid grid-cols-[1fr_auto] items-end gap-4 border-t border-hairline pt-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="type-body-sm text-ink-faint">Next milestone</span>
            {project.nextMilestone ? (
              <span className="truncate type-body-sm text-ink">
                {project.nextMilestone.name},{' '}
                {formatCalendarDate(project.nextMilestone.dueDate, today)}
              </span>
            ) : (
              <span className="type-body-sm text-ink-faint">None scheduled</span>
            )}
          </div>
          <EndDate project={project} today={today} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 type-body-sm text-ink-muted">
            <Avatar
              name={project.manager.fullName}
              hue={project.manager.avatarHue}
              size="xs"
              decorative
            />
            {project.manager.fullName}
          </span>
          <span className="type-body-sm text-ink-faint tabular-nums">
            {project.health.completedTaskCount} of{' '}
            {project.health.completedTaskCount + project.health.openTaskCount} tasks done
          </span>
        </div>
      </div>
    </motion.li>
  );
}
