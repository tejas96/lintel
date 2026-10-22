import { StaleVersionError } from '@lintel/shared';
import type { RequestContext } from '../common/request-context';
import type { ApplicationStores } from '../common/unit-of-work';
import type { TaskRecord } from '../tasks/task.store';
import { recordScheduleChange } from '../tasks/task-schedule-records';
import type { PreviewedMove } from './reschedule-plan';

export interface AppliedMove {
  readonly move: PreviewedMove;
  readonly before: TaskRecord;
  readonly after: TaskRecord;
}

/**
 * The locked task still has the dates and status the plan was worked out
 * from. Tasks pushed along by a move carry no version from the person, so a
 * change made since the plan was read must refuse the move, not be overwritten.
 */
function isAsPlanned(task: TaskRecord, move: PreviewedMove): boolean {
  return (
    task.status === move.status &&
    task.plannedStartDate === move.currentStartDate &&
    task.dueDate === move.currentDueDate
  );
}

/**
 * Moves each task to its planned dates (a task with a version from the
 * person must still be at it) and keeps schedule history for committed
 * deadlines, with the reason `reasonFor` gives.
 */
export async function applyTaskMoves(
  stores: ApplicationStores,
  context: RequestContext,
  moves: readonly PreviewedMove[],
  options: {
    readonly expectedVersions: ReadonlyMap<string, number>;
    readonly reasonFor: (move: PreviewedMove) => string;
  },
): Promise<AppliedMove[]> {
  const moved: AppliedMove[] = [];
  for (const move of moves) {
    const before = await stores.tasks.findForUpdate(move.taskId);
    if (!before) continue;
    const expected = options.expectedVersions.get(move.taskId) ?? before.version;
    const after =
      expected === before.version && isAsPlanned(before, move)
        ? await stores.tasks.update(before.id, before.version, {
            plannedStartDate: move.proposedStartDate,
            dueDate: move.proposedDueDate,
          })
        : null;
    if (!after) throw new StaleVersionError(`"${before.title}"`);
    if (move.committed) {
      await recordScheduleChange(stores, context, before, after, options.reasonFor(move));
    }
    moved.push({ move, before, after });
  }
  return moved;
}
