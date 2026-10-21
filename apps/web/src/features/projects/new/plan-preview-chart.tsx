'use client';

import type { PlanPreview } from '@lintel/api-contracts';
import {
  createTimelineScale,
  GanttBar,
  GanttChart,
  GanttDependencies,
  type GanttLink,
  GanttMilestoneMark,
  GanttRow,
} from '@lintel/design-system/web';
import { useMemo } from 'react';

type Row =
  | { kind: 'stage'; key: string; stage: PlanPreview['stages'][number] }
  | { kind: 'task'; key: string; task: PlanPreview['tasks'][number] };

function rowsOf(preview: PlanPreview): Row[] {
  return preview.stages.flatMap((stage): Row[] => [
    { kind: 'stage', key: `stage:${stage.key}`, stage },
    ...preview.tasks
      .filter((task) => task.stageKey === stage.key)
      .map((task): Row => ({ kind: 'task', key: task.key, task })),
  ]);
}

function linksOf(rows: readonly Row[]): GanttLink[] {
  const index = new Map(rows.map((row, position) => [row.key, position]));
  const tasks = new Map(
    rows.flatMap((row) => (row.kind === 'task' ? [[row.key, row.task] as const] : [])),
  );
  return rows.flatMap((row) => {
    if (row.kind !== 'task') return [];
    const toRow = index.get(row.key) ?? 0;
    return row.task.dependsOn.flatMap((key): GanttLink[] => {
      const from = tasks.get(key);
      const fromRow = index.get(key);
      if (!from || fromRow === undefined) return [];
      return [
        {
          id: `${key}-${row.key}`,
          fromRow,
          fromDate: from.dueDate,
          toRow,
          toDate: row.task.plannedStartDate,
          late: from.dueDate >= row.task.plannedStartDate,
        },
      ];
    });
  });
}

/**
 * The tailored plan as a timeline, read-only. Bars glide to their new dates
 * when the plan changes, so the effect of each edit is visible.
 */
export function PlanPreviewChart({
  preview,
  today,
}: {
  readonly preview: PlanPreview;
  readonly today: string;
}) {
  const rows = useMemo(() => rowsOf(preview), [preview]);
  const links = useMemo(() => linksOf(rows), [rows]);
  // A side column fits about six weeks at the month scale: the whole shape of most plans.
  const scale = createTimelineScale(preview.plannedStartDate, preview.plannedEndDate, 'month');
  return (
    <GanttChart
      scale={scale}
      today={today}
      label="Timeline of the tailored plan"
      focusDate={preview.plannedStartDate}
      labelWidth="compact"
      className="max-h-[26rem] overflow-y-auto"
      overlay={<GanttDependencies scale={scale} links={links} rowCount={rows.length} />}
    >
      {rows.map((row, index) =>
        row.kind === 'stage' ? (
          <GanttRow
            key={row.key}
            depth={0}
            label={<span className="truncate">{row.stage.name}</span>}
            className="bg-sunken/40"
          >
            <GanttBar
              scale={scale}
              start={row.stage.plannedStartDate}
              end={row.stage.plannedEndDate}
              tone="neutral"
              title={row.stage.name}
              statusLabel={row.stage.isAdded ? 'Added stage' : 'Stage'}
              index={index}
            />
            {row.stage.milestones.map((milestone) => (
              <GanttMilestoneMark
                key={milestone.key}
                scale={scale}
                date={milestone.dueDate}
                label={milestone.name}
              />
            ))}
          </GanttRow>
        ) : (
          <GanttRow key={row.key} label={<span className="truncate">{row.task.title}</span>}>
            <GanttBar
              scale={scale}
              start={row.task.plannedStartDate}
              end={row.task.dueDate}
              tone={row.task.overlapsPrerequisite ? 'atRisk' : 'neutral'}
              title={row.task.title}
              statusLabel={
                row.task.overlapsPrerequisite
                  ? 'Starts before the work it waits for ends'
                  : row.task.isAdded
                    ? 'Added task'
                    : 'Planned'
              }
              index={index}
            />
          </GanttRow>
        ),
      )}
    </GanttChart>
  );
}
