'use client';

import type { ProjectSummary } from '@lintel/api-contracts';
import { Avatar, cn, ResponsiveTable, type TableColumn } from '@lintel/design-system/web';
import Link from 'next/link';
import { swatchClass } from '@/features/tasks/task-presentation';
import { formatCalendarDate } from '@/lib/format/dates';
import { HealthPill } from './project-presentation';

export function ProjectsTable({
  projects,
  today,
}: {
  readonly projects: readonly ProjectSummary[];
  readonly today: string;
}) {
  const columns: TableColumn<ProjectSummary>[] = [
    {
      key: 'project',
      header: 'Project',
      primary: true,
      cell: (project) => (
        <span className="flex items-center gap-3">
          <span
            aria-hidden
            className={cn('h-8 w-1 shrink-0 rounded-full', swatchClass(project.colorIndex))}
          />
          <span className="flex min-w-0 flex-col">
            <Link
              href={`/projects/${project.id}`}
              className="lt-stretched-link truncate rounded-sm font-medium text-ink"
            >
              {project.name}
            </Link>
            <span className="font-mono text-[0.75rem] text-ink-faint">{project.reference}</span>
          </span>
        </span>
      ),
    },
    {
      key: 'client',
      header: 'Client',
      cell: (project) => <span className="text-ink-muted">{project.clientName}</span>,
    },
    {
      key: 'health',
      header: 'Health',
      cell: (project) => (
        <span className="relative z-[1] inline-flex">
          <HealthPill health={project.health} />
        </span>
      ),
    },
    {
      key: 'stage',
      header: 'Stage',
      cell: (project) =>
        project.currentStage ? (
          <span className="text-ink-muted">
            {project.currentStage.name}
            <span className="text-ink-faint tabular-nums">
              {' '}
              {project.currentStage.position + 1}/{project.currentStage.totalStages}
            </span>
          </span>
        ) : (
          <span className="text-ink-faint">None</span>
        ),
    },
    {
      key: 'milestone',
      header: 'Next milestone',
      hideOnPhone: true,
      cell: (project) =>
        project.nextMilestone ? (
          <span className="text-ink-muted">
            {project.nextMilestone.name}, {formatCalendarDate(project.nextMilestone.dueDate, today)}
          </span>
        ) : (
          <span className="text-ink-faint">None</span>
        ),
    },
    {
      key: 'manager',
      header: 'Manager',
      hideOnPhone: true,
      cell: (project) => (
        <span className="flex items-center gap-2 text-ink-muted">
          <Avatar
            name={project.manager.fullName}
            hue={project.manager.avatarHue}
            size="xs"
            decorative
          />
          {project.manager.fullName}
        </span>
      ),
    },
    {
      key: 'end',
      header: 'Ends',
      align: 'end',
      cell: (project) => (
        <span className="tabular-nums text-ink">
          {formatCalendarDate(project.plannedEndDate, today)}
        </span>
      ),
    },
  ];
  return (
    <ResponsiveTable
      caption="Projects"
      columns={columns}
      rows={projects}
      rowKey={(project) => project.id}
    />
  );
}
