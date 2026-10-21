'use client';

import type { ProjectDetail, TaskSummary } from '@lintel/api-contracts';
import type { GanttDateLine } from '@lintel/design-system/web';
import { useCallback, useMemo } from 'react';
import { formatCalendarDate } from '@/lib/format/dates';
import type { TaskRowView } from './timeline-chart';
import { useReschedule } from './use-reschedule';
import { type TimelineEdit, useTimelineEdit } from './use-timeline-edit';

/**
 * Everything the timeline needs to reschedule by dragging: the bar being
 * edited, the server's preview of its knock-on, the dates to draw for every
 * bar, the agreed and proposed end lines, and apply / propose / cancel.
 */
export function useTimelineReschedule(
  project: ProjectDetail | undefined,
  tasks: readonly TaskSummary[],
  dayWidth: number,
  today: string,
) {
  const mutations = useReschedule(project?.id ?? '');
  const { preview } = mutations;
  const requestPreview = preview.mutate;
  const review = useCallback(
    (edit: TimelineEdit) =>
      requestPreview({ taskId: edit.taskId, plannedStartDate: edit.start, dueDate: edit.end }),
    [requestPreview],
  );
  const { edit, startDrag, keyDown, cancel: cancelEdit } = useTimelineEdit(dayWidth, review);
  const reviewing = edit?.phase === 'reviewing';
  const proposals = useMemo(() => {
    const moves = reviewing ? (preview.data?.moves ?? []) : [];
    return new Map(moves.map((move) => [move.taskId, move]));
  }, [reviewing, preview.data]);

  const shownDates = useCallback(
    (row: TaskRowView) => {
      if (edit?.taskId === row.task.id && edit.phase !== 'reviewing') {
        return { start: edit.start, end: edit.end, state: 'dragging' as const };
      }
      const move = proposals.get(row.task.id);
      if (move) {
        return {
          start: move.proposedStartDate ?? move.proposedDueDate,
          end: move.proposedDueDate,
          state: 'proposed' as const,
        };
      }
      if (edit?.taskId === row.task.id) {
        return { start: edit.start, end: edit.end, state: 'proposed' as const };
      }
      return { start: row.start, end: row.end, state: 'idle' as const };
    },
    [edit, proposals],
  );

  const dateLines: GanttDateLine[] = useMemo(() => {
    if (!project) return [];
    const lines: GanttDateLine[] = [
      {
        id: 'agreed',
        date: project.plannedEndDate,
        label: `Agreed end ${formatCalendarDate(project.plannedEndDate, today)}`,
        kind: 'agreed',
      },
    ];
    const forecast = reviewing ? preview.data?.forecastEndDate : null;
    if (forecast && preview.data?.requiresScopeChange) {
      lines.push({
        id: 'proposed',
        date: forecast,
        label: `New end ${formatCalendarDate(forecast, today)}`,
        kind: 'proposed',
      });
    }
    return lines;
  }, [project, reviewing, preview.data, today]);

  const resetPreview = preview.reset;
  const resetApply = mutations.apply.reset;
  const resetPropose = mutations.propose.reset;
  const editedId = edit?.taskId;
  const cancel = useCallback(() => {
    cancelEdit();
    resetPreview();
    resetApply();
    resetPropose();
    // Back to the bar that was moved, so a keyboard user carries on from there.
    window.requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>(`[data-gantt-key="${editedId}"]`)
        ?.focus({ preventScroll: true }),
    );
  }, [cancelEdit, resetPreview, resetApply, resetPropose, editedId]);

  const own = preview.data?.moves.find((move) => !move.isDownstream);
  const change =
    edit && own
      ? {
          taskId: edit.taskId,
          plannedStartDate: own.proposedStartDate ?? own.proposedDueDate,
          dueDate: own.proposedDueDate,
        }
      : null;
  const editedTask = tasks.find((task) => task.id === edit?.taskId);
  const apply = (reason: string | null) => {
    if (!change || !editedTask) return;
    mutations.apply.mutate({ change, reason, version: editedTask.version }, { onSuccess: cancel });
  };
  const propose = (title: string, description: string) => {
    if (!change) return;
    mutations.propose.mutate({ change, title, description }, { onSuccess: cancel });
  };

  return {
    edit,
    reviewing,
    editedTask,
    preview,
    saving: mutations.apply.isPending || mutations.propose.isPending,
    saveError: mutations.apply.error ?? mutations.propose.error,
    shownDates,
    dateLines,
    startDrag,
    keyDown,
    cancel,
    apply,
    propose,
  };
}
