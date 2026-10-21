'use client';

import type { TaskSummary } from '@lintel/api-contracts';
import {
  Card,
  CardHeader,
  KpiTile,
  MilestoneTimeline,
  SkeletonText,
} from '@lintel/design-system/web';
import { ProjectProfitabilityPanel } from '@/features/finances/project-profitability-panel';
import { useSession } from '@/features/session/session-provider';
import { daysBetween, todayIn } from '@/lib/format/dates';
import {
  OverviewBlockers,
  OverviewRisks,
  TeamAllocation,
  UpcomingDeadlines,
} from './overview-panels';
import { useProject, useProjectTasks } from './use-project-room';

const OPEN = new Set([
  'draft',
  'ready',
  'in_progress',
  'blocked',
  'in_review',
  'changes_requested',
]);

export function OverviewTab({ projectId }: { readonly projectId: string }) {
  const { user } = useSession();
  const today = todayIn(user.timeZone);
  const project = useProject(projectId).data;
  const tasks = useProjectTasks(projectId);
  if (!project) return null;
  const openTasks: TaskSummary[] = (tasks.data?.items ?? []).filter((task) =>
    OPEN.has(task.status),
  );
  const upcoming = openTasks
    .filter((task) => task.dueDate !== null && daysBetween(today, task.dueDate) <= 14)
    .sort((left, right) => (left.dueDate ?? '').localeCompare(right.dueDate ?? ''));
  const { health } = project;
  const end =
    health.forecastEndDate && health.forecastEndDate > project.plannedEndDate
      ? health.forecastEndDate
      : project.plannedEndDate;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="Open tasks" value={health.openTaskCount} goodDirection="none" />
        <KpiTile
          label="Overdue"
          value={health.overdueTaskCount}
          goodDirection="down"
          detail={health.overdueTaskCount === 0 ? 'Nothing late' : 'Past their due date'}
        />
        <KpiTile
          label="Blocked"
          value={health.blockedTaskCount}
          goodDirection="down"
          detail={
            health.blockedTaskCount === 0 ? 'Nothing waiting on others' : 'Waiting on someone'
          }
        />
        <KpiTile
          label="Done"
          value={health.completedTaskCount}
          detail={`of ${health.completedTaskCount + health.openTaskCount} tasks`}
        />
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader title="Milestones" description="Where the project should be, and when." />
            <div className="px-5 pb-4">
              {project.milestones.length > 0 ? (
                <MilestoneTimeline
                  start={project.plannedStartDate}
                  end={end}
                  today={today}
                  milestones={project.milestones}
                />
              ) : (
                <p className="pb-2 type-body-sm text-ink-faint">No milestones on this project.</p>
              )}
            </div>
          </Card>
          <Card>
            <CardHeader
              title="Due in the next two weeks"
              description={
                tasks.data
                  ? `${upcoming.length} open ${upcoming.length === 1 ? 'task' : 'tasks'}`
                  : undefined
              }
            />
            <div className="px-2 pb-3">
              {tasks.isPending ? (
                <SkeletonText lines={4} className="px-3" />
              ) : (
                <UpcomingDeadlines tasks={upcoming} today={today} />
              )}
            </div>
          </Card>
          <ProjectProfitabilityPanel project={project} today={today} />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <OverviewRisks project={project} today={today} />
          <OverviewBlockers projectId={projectId} />
          <TeamAllocation members={project.members} openTasks={openTasks} />
        </div>
      </div>
    </div>
  );
}
