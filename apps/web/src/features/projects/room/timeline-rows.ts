import type { ProjectDetail, TaskDetail, TaskSummary } from '@lintel/api-contracts';
import type { GanttLink, PillTone } from '@lintel/design-system/web';

export type TimelineRow =
  | {
      readonly kind: 'stage';
      readonly id: string;
      readonly stage: ProjectDetail['stages'][number];
      readonly taskCount: number;
    }
  | {
      readonly kind: 'task';
      readonly id: string;
      readonly task: TaskSummary;
      readonly start: string;
      readonly end: string;
    };

export function taskTone(task: TaskSummary): PillTone {
  if (task.status === 'done') return 'done';
  if (task.status === 'blocked' || task.hasOpenBlocker) return 'blocked';
  if (task.isOverdue) return 'overdue';
  if (task.status === 'in_review') return 'review';
  if (task.status === 'changes_requested') return 'atRisk';
  return 'neutral';
}

function datedRange(task: TaskSummary): { start: string; end: string } | null {
  const start = task.plannedStartDate ?? task.dueDate;
  const end = task.dueDate ?? task.plannedStartDate;
  if (!start || !end) return null;
  return start <= end ? { start, end } : { start: end, end: start };
}

/** Stage header rows followed by their dated tasks; collapsed stages hide their tasks. */
export function buildTimelineRows(
  project: ProjectDetail,
  tasks: readonly TaskSummary[],
  collapsed: ReadonlySet<string>,
): { rows: TimelineRow[]; undated: number } {
  const rows: TimelineRow[] = [];
  let undated = 0;
  const visible = tasks.filter((task) => task.status !== 'cancelled');
  const stages = [...project.stages].sort((left, right) => left.position - right.position);
  const groups: { stage: (typeof stages)[number] | null; tasks: TaskSummary[] }[] = [
    ...stages.map((stage) => ({
      stage,
      tasks: visible.filter((task) => task.stage?.id === stage.id),
    })),
    {
      stage: null,
      tasks: visible.filter(
        (task) => !task.stage || !stages.some((stage) => stage.id === task.stage?.id),
      ),
    },
  ];
  for (const group of groups) {
    const dated = group.tasks
      .map((task) => ({ task, range: datedRange(task) }))
      .filter(
        (entry): entry is { task: TaskSummary; range: { start: string; end: string } } =>
          entry.range !== null,
      )
      .sort((left, right) => left.range.start.localeCompare(right.range.start));
    undated += group.tasks.length - dated.length;
    if (group.stage)
      rows.push({ kind: 'stage', id: group.stage.id, stage: group.stage, taskCount: dated.length });
    if (group.stage && collapsed.has(group.stage.id)) continue;
    for (const { task, range } of dated) rows.push({ kind: 'task', id: task.id, task, ...range });
  }
  return { rows, undated };
}

/** Elbow links for every prerequisite whose both ends are on screen. */
export function buildLinks(
  rows: readonly TimelineRow[],
  details: readonly TaskDetail[],
): GanttLink[] {
  const rowIndex = new Map(rows.map((row, index) => [row.id, index]));
  const byId = new Map(
    rows.flatMap((row) => (row.kind === 'task' ? [[row.id, row] as const] : [])),
  );
  const links: GanttLink[] = [];
  for (const detail of details) {
    const to = byId.get(detail.id);
    const toRow = rowIndex.get(detail.id);
    if (!to || toRow === undefined) continue;
    for (const prerequisite of detail.prerequisites) {
      const from = byId.get(prerequisite.id);
      const fromRow = rowIndex.get(prerequisite.id);
      if (!from || fromRow === undefined) continue;
      links.push({
        id: `${prerequisite.id}-${detail.id}`,
        fromRow,
        fromDate: from.end,
        toRow,
        toDate: to.start,
        late: from.end >= to.start && prerequisite.status !== 'done',
      });
    }
  }
  return links;
}

/** The whole span to draw: project dates widened to fit every task. */
export function timelineRange(
  project: ProjectDetail,
  rows: readonly TimelineRow[],
): { start: string; end: string } {
  let start = project.plannedStartDate;
  let end =
    project.health.forecastEndDate && project.health.forecastEndDate > project.plannedEndDate
      ? project.health.forecastEndDate
      : project.plannedEndDate;
  for (const row of rows) {
    if (row.kind !== 'task') continue;
    if (row.start < start) start = row.start;
    if (row.end > end) end = row.end;
  }
  return { start, end };
}
