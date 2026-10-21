'use client';

import {
  Button,
  createTimelineScale,
  EmptyState,
  SegmentedControl,
  Skeleton,
  SkeletonGroup,
  type TimelineZoom,
  useCalmMotion,
} from '@lintel/design-system/web';
import { useQueries } from '@tanstack/react-query';
import { Move } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useSession } from '@/features/session/session-provider';
import { api, expectStatus } from '@/lib/api/api-client';
import { todayIn } from '@/lib/format/dates';
import { queryKeys } from '@/lib/query/query-keys';
import { ReschedulePanel } from './reschedule-panel';
import { TimelineChart } from './timeline-chart';
import { buildLinks, buildTimelineRows, timelineRange } from './timeline-rows';
import { useProject, useProjectTasks } from './use-project-room';
import { useTimelineReschedule } from './use-timeline-reschedule';

const DAY_WIDTH: Readonly<Record<TimelineZoom, number>> = { week: 32, month: 9 };

/**
 * Gantt of the project: stages that fold, task bars, dependency lines and a
 * today line. Project managers drag bars to reschedule and see the knock-on
 * before anything is saved; the keyboard does the same from a focused bar.
 */
export function TimelineTab({ projectId }: { readonly projectId: string }) {
  const { user } = useSession();
  const router = useRouter();
  const hintId = useId();
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
    setCollapsed(new Set(project.stages.filter((s) => s.status === 'completed').map((s) => s.id)));
  }, [project]);
  const items = tasks.data?.items ?? [];
  const taskIds = items.slice(0, 60).map((task) => task.id);
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
  const reschedule = useTimelineReschedule(project, items, DAY_WIDTH[zoom], today);
  const calm = useCalmMotion();
  const reviewedId = reschedule.reviewing ? reschedule.edit?.taskId : undefined;
  useEffect(() => {
    // Keep the moved bar in view above the floating review.
    if (!reviewedId) return;
    document
      .querySelector(`[data-gantt-key="${reviewedId}"]`)
      ?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: calm ? 'auto' : 'smooth' });
  }, [reviewedId, calm]);

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
  // Links follow the bars as they are dragged or proposed.
  const shownRows = built.rows.map((row) =>
    row.kind === 'task' ? { ...row, ...reschedule.shownDates(row) } : row,
  );
  const links = buildLinks(shownRows, loadedDetails);
  const toggle = (stageId: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(stageId)) next.delete(stageId);
      else next.add(stageId);
      return next;
    });
  const stageIds = project.stages.map((stage) => stage.id);
  const canEdit = project.viewerCanManage;

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
      {canEdit && (
        <p id={hintId} className="flex items-start gap-2 type-body-sm text-ink-muted">
          <Move aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-faint" />
          <span className="pointer-coarse:hidden">
            Drag a bar to move it, or drag its ends to change its dates. With the keyboard, focus a
            bar and use ← → to move it, Shift + ← → for its end, Alt + ← → for its start, then
            Enter. You see what follows before anything is saved.
          </span>
          <span className="hidden pointer-coarse:inline">
            On a touch screen, open a task to change its dates. On a computer you can drag the bars
            and see what follows before anything is saved.
          </span>
        </p>
      )}
      <TimelineChart
        project={project}
        rows={built.rows}
        scale={scale}
        today={today}
        links={links}
        collapsed={collapsed}
        onToggleStage={toggle}
        canEdit={canEdit}
        shownDates={reschedule.shownDates}
        dateLines={reschedule.dateLines}
        hintId={hintId}
        onOpen={(taskId) => router.push(`/tasks/${taskId}`)}
        onBarPointerDown={(row, part, event) => {
          // One change at a time: finish or put back the one being reviewed first.
          if (reschedule.reviewing) return;
          reschedule.startDrag({ id: row.task.id, start: row.start, end: row.end }, part, event);
        }}
        onBarKeyDown={(row, event) => {
          if (reschedule.reviewing) return;
          reschedule.keyDown({ id: row.task.id, start: row.start, end: row.end }, event);
        }}
      />
      {/* The review floats over the page, so the chart stays put and its bars can be seen moving. */}
      <AnimatePresence>
        {reschedule.reviewing && reschedule.editedTask && (
          <div className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-2xl sm:bottom-6">
            <ReschedulePanel
              key={reschedule.edit?.taskId}
              taskTitle={reschedule.editedTask.title}
              preview={reschedule.preview.data}
              previewError={reschedule.preview.error}
              saving={reschedule.saving}
              saveError={reschedule.saveError}
              today={today}
              onCancel={reschedule.cancel}
              onApply={reschedule.apply}
              onPropose={reschedule.propose}
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
