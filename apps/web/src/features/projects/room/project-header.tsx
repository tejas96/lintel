'use client';

import type { ProjectDetail } from '@lintel/api-contracts';
import { Avatar, cn, StageTracker } from '@lintel/design-system/web';
import { PROJECT_TYPE_LABELS } from '@lintel/domain';
import { CircleAlert, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { swatchClass } from '@/features/tasks/task-presentation';
import { daysBetween, formatCalendarDate, withReadableDates } from '@/lib/format/dates';
import { HealthPill, PROJECT_STATUS_LABELS } from '../project-presentation';

function Cell({
  label,
  children,
  className,
}: {
  readonly label: string;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1 px-4 py-3', className)}>
      <dt className="type-body-sm text-ink-faint">{label}</dt>
      <dd className="flex min-h-6 items-center gap-2 truncate type-body-sm text-ink">{children}</dd>
    </div>
  );
}

/**
 * The project's title block, as on a drawing sheet: who it is for, who runs
 * it, and its dates against the plan agreed at the start.
 */
export function ProjectHeader({
  project,
  today,
}: {
  readonly project: ProjectDetail;
  readonly today: string;
}) {
  // The schedule forecast (plan, late starts, blockers, prerequisites): the risk cards' date.
  const forecast = project.health.forecastEndDate;
  const slip = forecast ? daysBetween(project.baselineEndDate, forecast) : 0;
  const stages = [...project.stages]
    .sort((left, right) => left.position - right.position)
    .map((stage) => ({
      id: stage.id,
      name: stage.name,
      status: stage.status,
      progress: stage.taskCounts.total === 0 ? 0 : stage.taskCounts.done / stage.taskCounts.total,
    }));
  return (
    <header className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 type-body-sm text-ink-muted">
            <span
              aria-hidden
              className={cn('size-2.5 rounded-[3px]', swatchClass(project.colorIndex))}
            />
            <span className="font-mono text-[0.75rem] text-ink-faint">{project.reference}</span>
            {PROJECT_TYPE_LABELS[project.projectType]}
            {project.status !== 'active' && (
              <span className="text-ink-faint">{PROJECT_STATUS_LABELS[project.status]}</span>
            )}
          </p>
          <h1 className="type-display-md text-balance text-ink md:type-display-lg">
            {project.name}
          </h1>
        </div>
        <span className="self-start sm:self-auto">
          <HealthPill health={project.health} size="md" />
        </span>
      </div>
      <dl className="grid grid-cols-2 divide-hairline overflow-hidden rounded-lg border border-hairline bg-raised sm:grid-cols-3 xl:grid-cols-6 [&>div]:border-hairline [&>div]:border-b xl:[&>div]:border-b-0 xl:[&>div:not(:last-child)]:border-r">
        <Cell label="Client">{project.clientName}</Cell>
        <Cell label="Manager">
          <Avatar
            name={project.manager.fullName}
            hue={project.manager.avatarHue}
            size="xs"
            decorative
          />
          <span className="truncate">{project.manager.fullName}</span>
        </Cell>
        <Cell label="Started">{formatCalendarDate(project.plannedStartDate, today)}</Cell>
        <Cell label="Planned end">{formatCalendarDate(project.plannedEndDate, today)}</Cell>
        <Cell label="Agreed at start">{formatCalendarDate(project.baselineEndDate, today)}</Cell>
        <Cell label="Forecast">
          {forecast ? (
            <span className={slip > 0 ? 'font-medium text-at-risk' : undefined}>
              {formatCalendarDate(forecast, today)}
              {slip > 0 && `, ${slip} ${slip === 1 ? 'day' : 'days'} late`}
              {slip < 0 && `, ${Math.abs(slip)} early`}
            </span>
          ) : (
            <span className="text-ink-faint">Not enough dates yet</span>
          )}
        </Cell>
      </dl>
      {stages.length > 0 && (
        <StageTracker stages={stages} variant="full" className="hidden md:flex" />
      )}
      {stages.length > 0 && <StageTracker stages={stages} className="md:hidden" />}
      {project.health.reasons.length > 0 && (
        <ul
          className={cn(
            'flex flex-col gap-1.5 rounded-lg border p-4',
            project.health.reasons.some((reason) => reason.severity === 'critical')
              ? 'border-overdue-solid/30 bg-overdue-tint/50'
              : 'border-at-risk-solid/30 bg-at-risk-tint/50',
          )}
        >
          {project.health.reasons.map((reason) => (
            <li key={reason.message} className="flex items-start gap-2 type-body-sm text-ink">
              {reason.severity === 'critical' ? (
                <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-overdue" />
              ) : (
                <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-at-risk" />
              )}
              <span>
                <span className="sr-only">
                  {reason.severity === 'critical' ? 'Critical: ' : 'Risk: '}
                </span>
                {withReadableDates(reason.message)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </header>
  );
}
