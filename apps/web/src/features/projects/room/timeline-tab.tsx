'use client';

import {
  Button,
  cn,
  createTimelineScale,
  EmptyState,
  GanttBar,
  GanttChart,
  GanttDependencies,
  GanttMilestoneMark,
  GanttRow,
  SegmentedControl,
  Skeleton,
  SkeletonGroup,
  type TimelineZoom,
} from '@lintel/design-system/web';
import { useQueries } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from '@/features/session/session-provider';
import { TASK_STATUS_PRESENTATION } from '@/features/tasks/task-presentation';
import { api, expectStatus } from '@/lib/api/api-client';
import { todayIn } from '@/lib/format/dates';
import { queryKeys } from '@/lib/query/query-keys';
import { buildLinks, buildTimelineRows, taskTone, timelineRange } from './timeline-rows';
import { useProject, useProjectTasks } from './use-project-room';

const STAGE_TONE = {
  completed: 'done',
  active: 'neutral',
  pending: 'neutral',
  skipped: 'neutral',
} as const;

/** Gantt of the project: stages that fold, task bars, dependency lines and a today line. */
export function TimelineTab({ projectId }: { readonly projectId: string }) {
  const { user } = useSession();
  const router = useRouter();
  const today = todayIn(user.timeZone);
  const project = useProject(projectId).data;
  const tasks = useProjectTasks(projectId);
  const [zoom, setZoom] = useState<TimelineZoom>('week');
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const foldedFinished = useRef(false);
  useEffect(() => {
    // Finished stages start folded so the chart opens on the work still to do.
    if (!project || foldedFinished.current) return;
    foldedFinished.current = true;
    setCollapsed(
      new Set(
        project.stages.filter((stage) => stage.status === 'completed').map((stage) => stage.id),
      ),
    );
  }, [project]);
  const taskIds = (tasks.data?.items ?? []).slice(0, 60).map((task) => task.id);
  const details = useQueries({
    queries: taskIds.map((id) => ({
      queryKey: queryKeys.task(id),
      queryFn: () => expectStatus(api.tasks.getTask({ params: { id } }), 200),
      staleTime: 60_000,
    })),
  });
  const loadedDetails = details.flatMap((query) => (query.data ? [query.data] : []));
  const built = useMemo(
    () => (project && tasks.data ? buildTimelineRows(project, tasks.data.items, collapsed) : null),
    [project, tasks.data, collapsed],
  );

  if (!project || tasks.isPending || !built) {
    return (
      <SkeletonGroup label="Loading the timeline">
        <Skeleton className="h-96 w-full rounded-lg" />
      </SkeletonGroup>
    );
  }
  if (built.rows.every((row) => row.kind === 'stage') && built.undated > 0) {
    return (
      <EmptyState
        drawing="plan"
        title="Nothing is dated yet"
        description="Tasks appear here once they have a start or due date."
      />
    );
  }
  const range = timelineRange(project, built.rows);
  const scale = createTimelineScale(range.start, range.end, zoom);
  const links = buildLinks(built.rows, loadedDetails);
  const toggle = (stageId: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(stageId)) next.delete(stageId);
      else next.add(stageId);
      return next;
    });
  const stageIds = project.stages.map((stage) => stage.id);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          label="Zoom"
          value={zoom}
          onValueChange={setZoom}
          options={[
            { value: 'week', label: 'Weeks' },
            { value: 'month', label: 'Months' },
          ]}
          size="sm"
        />
        <div className="flex items-center gap-2">
          {built.undated > 0 && (
            <span className="type-body-sm text-ink-faint">
              {built.undated} undated {built.undated === 1 ? 'task is' : 'tasks are'} not shown
            </span>
          )}
          <Button
            size="sm"
            variant="quiet"
            onClick={() => setCollapsed(collapsed.size > 0 ? new Set() : new Set(stageIds))}
          >
            {collapsed.size > 0 ? 'Expand all stages' : 'Collapse all stages'}
          </Button>
        </div>
      </div>
      <GanttChart
        scale={scale}
        today={today}
        label={`Timeline for ${project.name}`}
        overlay={<GanttDependencies scale={scale} links={links} rowCount={built.rows.length} />}
      >
        {built.rows.map((row, index) =>
          row.kind === 'stage' ? (
            <GanttRow
              key={row.id}
              depth={0}
              label={
                <button
                  type="button"
                  aria-expanded={!collapsed.has(row.id)}
                  onClick={() => toggle(row.id)}
                  className="flex min-h-9 min-w-0 items-center gap-1.5 rounded-sm text-left"
                >
                  <ChevronRight
                    aria-hidden
                    className={cn(
                      'size-4 shrink-0 text-ink-faint transition-transform duration-(--duration-base)',
                      !collapsed.has(row.id) && 'rotate-90',
                    )}
                  />
                  <span className="truncate">{row.stage.name}</span>
                  <span className="shrink-0 font-normal text-ink-faint tabular-nums">
                    {row.taskCount}
                  </span>
                </button>
              }
              className="bg-sunken/40"
            >
              {row.stage.plannedStartDate && row.stage.plannedEndDate && (
                <GanttBar
                  scale={scale}
                  start={row.stage.plannedStartDate}
                  end={row.stage.plannedEndDate}
                  tone={STAGE_TONE[row.stage.status]}
                  title={row.stage.name}
                  statusLabel={row.stage.status}
                  index={index}
                />
              )}
              {project.milestones
                .filter((milestone) => milestone.stageId === row.id)
                .map((milestone) => (
                  <GanttMilestoneMark
                    key={milestone.id}
                    scale={scale}
                    date={milestone.dueDate}
                    label={milestone.name}
                  />
                ))}
            </GanttRow>
          ) : (
            <GanttRow key={row.id} label={<span className="truncate">{row.task.title}</span>}>
              <GanttBar
                scale={scale}
                start={row.start}
                end={row.end}
                tone={taskTone(row.task)}
                title={row.task.title}
                statusLabel={TASK_STATUS_PRESENTATION[row.task.status].label}
                progress={
                  row.task.checklist.total > 0
                    ? row.task.checklist.done / row.task.checklist.total
                    : undefined
                }
                index={index}
                onSelect={() => router.push(`/tasks/${row.task.id}`)}
              />
            </GanttRow>
          ),
        )}
      </GanttChart>
    </div>
  );
}
