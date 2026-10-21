'use client';

import type { ProjectDetail } from '@lintel/api-contracts';
import {
  cn,
  GanttBar,
  GanttChart,
  type GanttDateLine,
  GanttDateLines,
  GanttDependencies,
  type GanttDragPart,
  GanttEditableBar,
  type GanttLink,
  GanttMilestoneMark,
  GanttRow,
  type TimelineScale,
} from '@lintel/design-system/web';
import { ChevronRight } from 'lucide-react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { TASK_STATUS_PRESENTATION } from '@/features/tasks/task-presentation';
import { type TimelineRow, taskTone } from './timeline-rows';

const STAGE_TONE = {
  completed: 'done',
  active: 'neutral',
  pending: 'neutral',
  skipped: 'neutral',
} as const;

const CLOSED = new Set(['done', 'cancelled']);

export type TaskRowView = Extract<TimelineRow, { kind: 'task' }>;

interface TimelineChartProps {
  readonly project: ProjectDetail;
  readonly rows: readonly TimelineRow[];
  readonly scale: TimelineScale;
  readonly today: string;
  readonly links: readonly GanttLink[];
  readonly collapsed: ReadonlySet<string>;
  readonly onToggleStage: (stageId: string) => void;
  /** Project managers move and resize bars; everyone else opens the task. */
  readonly canEdit: boolean;
  /** Dates shown instead of the saved ones (a drag, or a proposed knock-on). */
  readonly shownDates: (row: TaskRowView) => {
    start: string;
    end: string;
    state: 'idle' | 'dragging' | 'proposed';
  };
  readonly dateLines: readonly GanttDateLine[];
  readonly hintId: string;
  readonly onOpen: (taskId: string) => void;
  readonly onBarPointerDown: (
    row: TaskRowView,
    part: GanttDragPart,
    event: PointerEvent<HTMLElement>,
  ) => void;
  readonly onBarKeyDown: (row: TaskRowView, event: KeyboardEvent<HTMLButtonElement>) => void;
}

/** Gantt of the project: stages that fold, task bars (editable for managers), lines and today. */
export function TimelineChart(props: TimelineChartProps) {
  const { project, rows, scale, today, collapsed } = props;
  return (
    <GanttChart
      scale={scale}
      today={today}
      label={`Timeline for ${project.name}`}
      overlay={
        <>
          <GanttDependencies scale={scale} links={props.links} rowCount={rows.length} />
          <GanttDateLines scale={scale} lines={props.dateLines} />
        </>
      }
    >
      {rows.map((row, index) => {
        if (row.kind === 'stage') {
          return (
            <GanttRow
              key={row.id}
              depth={0}
              label={
                <button
                  type="button"
                  aria-expanded={!collapsed.has(row.id)}
                  onClick={() => props.onToggleStage(row.id)}
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
          );
        }
        const status = TASK_STATUS_PRESENTATION[row.task.status].label;
        const progress =
          row.task.checklist.total > 0
            ? row.task.checklist.done / row.task.checklist.total
            : undefined;
        const editable = props.canEdit && !CLOSED.has(row.task.status);
        const shown = props.shownDates(row);
        return (
          <GanttRow key={row.id} label={<span className="truncate">{row.task.title}</span>}>
            {editable ? (
              <GanttEditableBar
                scale={scale}
                start={shown.start}
                end={shown.end}
                from={{ start: row.start, end: row.end }}
                state={shown.state}
                barKey={row.task.id}
                tone={taskTone(row.task)}
                title={row.task.title}
                statusLabel={status}
                progress={progress}
                describedBy={props.hintId}
                onSelect={() => props.onOpen(row.task.id)}
                onPointerDownPart={(part, event) => props.onBarPointerDown(row, part, event)}
                onKeyDown={(event) => props.onBarKeyDown(row, event)}
              />
            ) : (
              <GanttBar
                scale={scale}
                start={row.start}
                end={row.end}
                tone={taskTone(row.task)}
                title={row.task.title}
                statusLabel={status}
                progress={progress}
                index={index}
                onSelect={() => props.onOpen(row.task.id)}
              />
            )}
          </GanttRow>
        );
      })}
    </GanttChart>
  );
}
