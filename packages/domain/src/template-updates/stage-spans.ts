import { type CalendarDate, isCalendarDate, maxCalendarDate, minCalendarDate } from '@lintel/shared';
import type { ProjectWorkflowSnapshot } from './template-update.types';

export interface StageSpan {
  readonly start: CalendarDate;
  readonly end: CalendarDate;
}

/**
 * Where each of the project's stages sits today, by template key: from the
 * earliest planned start to the latest due date of its tasks that are not
 * cancelled. Stages with no dated task are left out.
 */
export function existingStageSpans(snapshot: ProjectWorkflowSnapshot): Map<string, StageSpan> {
  const keyById = new Map(
    snapshot.stages.flatMap((stage) =>
      stage.templateKey ? [[stage.id, stage.templateKey] as const] : [],
    ),
  );
  const spans = new Map<string, StageSpan>();
  for (const task of snapshot.tasks) {
    if (task.status === 'cancelled' || task.stageId === null) continue;
    const key = keyById.get(task.stageId);
    if (!key) continue;
    const dates = [task.plannedStartDate, task.dueDate].filter(
      (date): date is CalendarDate => date !== null && isCalendarDate(date),
    );
    if (dates.length === 0) continue;
    const start = dates.reduce((min, date) => minCalendarDate(min, date));
    const end = dates.reduce((max, date) => maxCalendarDate(max, date));
    const span = spans.get(key);
    spans.set(
      key,
      span
        ? { start: minCalendarDate(span.start, start), end: maxCalendarDate(span.end, end) }
        : { start, end },
    );
  }
  return spans;
}
