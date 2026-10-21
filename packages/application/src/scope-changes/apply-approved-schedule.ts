import { domainEvent, isOpenTaskStatus } from '@lintel/domain';
import type { RecordStore } from '../common/record.store';
import type { SettingsStore } from '../settings/settings.store';
import type {
  ProjectScheduleFacts,
  ScheduleTaskFact,
  ScopeChangeRecord,
  ScopeChangeStore,
  StoredScopeChangeImpact,
} from './scope-change.store';
import { shiftOptionalDate } from './scope-change-impact';

export interface AppliedTaskMove {
  readonly taskId: string;
  readonly ownerUserId: string | null;
  readonly previousDueDate: string | null;
  readonly dueDate: string | null;
}

/** The stores an approval writes through (narrow, so it is easy to fake in tests). */
export interface ScheduleStores {
  readonly scopeChanges: ScopeChangeStore;
  readonly settings: Pick<SettingsStore, 'defaultCalendar'>;
  readonly records: Pick<RecordStore, 'enqueueEvent'>;
}

export interface ApprovedSchedule {
  readonly scopeChange: ScopeChangeRecord;
  readonly note: string;
  readonly decidedByUserId: string;
}

function latest(dates: readonly (string | null)[]): string | null {
  return dates.reduce<string | null>(
    (max, date) => (date && (!max || date > max) ? date : max),
    null,
  );
}

type Calendar = Awaited<ReturnType<ScheduleStores['settings']['defaultCalendar']>>;

/**
 * The dates approval gives a task: exact dates dragged on the timeline as
 * proposed, otherwise the approved shift applied to the task's current dates.
 */
function approvedDates(
  calendar: Calendar,
  task: ScheduleTaskFact,
  impact: StoredScopeChangeImpact,
): { startDate: string | null; dueDate: string | null } {
  if (impact.appliesExactDates) {
    return {
      startDate: impact.proposedStartDate ?? task.plannedStartDate,
      dueDate: impact.proposedDueDate,
    };
  }
  return {
    startDate: shiftOptionalDate(calendar, task.plannedStartDate, impact.shiftWorkingDays),
    dueDate: shiftOptionalDate(calendar, task.dueDate, impact.shiftWorkingDays),
  };
}

/**
 * Applies each approved move — a shift to the task's *current* dates (it may
 * have moved since the proposal), or the exact dates proposed — records the
 * history, then extends milestones and the project's planned end when the
 * new dates run past them.
 */
export async function applyApprovedSchedule(
  stores: ScheduleStores,
  approved: ApprovedSchedule,
): Promise<AppliedTaskMove[]> {
  const { scopeChange } = approved;
  const facts = await stores.scopeChanges.scheduleFacts(scopeChange.projectId);
  if (!facts) return [];
  const calendar = await stores.settings.defaultCalendar();
  const tasks = new Map(facts.tasks.map((task) => [task.id, task]));
  const moves: AppliedTaskMove[] = [];
  for (const impact of await stores.scopeChanges.impactsOf(scopeChange.id)) {
    const task = tasks.get(impact.taskId);
    if (!task || !isOpenTaskStatus(task.status)) continue;
    const { startDate, dueDate } = approvedDates(calendar, task, impact);
    if (task.dueDate !== impact.currentDueDate || dueDate !== impact.proposedDueDate) {
      await stores.scopeChanges.correctImpact(impact.id, task.dueDate, dueDate);
    }
    if (dueDate === task.dueDate && startDate === task.plannedStartDate) continue;
    await stores.scopeChanges.rescheduleTask({
      taskId: task.id,
      previousDueDate: task.dueDate,
      plannedStartDate: startDate,
      dueDate,
      reason: `Scope change "${scopeChange.title}" approved: ${approved.note}`,
      scopeChangeId: scopeChange.id,
      changedByUserId: approved.decidedByUserId,
    });
    await stores.records.enqueueEvent(
      domainEvent('TaskScheduleChanged', 'task', task.id, {
        taskId: task.id,
        projectId: scopeChange.projectId,
        dueDate,
      }),
    );
    moves.push({
      taskId: task.id,
      ownerUserId: task.ownerUserId,
      previousDueDate: task.dueDate,
      dueDate,
    });
  }
  await extendCommitments(stores, facts, moves);
  return moves;
}

async function extendCommitments(
  stores: Pick<ScheduleStores, 'scopeChanges'>,
  facts: ProjectScheduleFacts,
  moves: readonly AppliedTaskMove[],
): Promise<void> {
  if (moves.length === 0) return;
  const moved = new Map(moves.map((move) => [move.taskId, move.dueDate]));
  const openTasks = facts.tasks
    .filter((task) => isOpenTaskStatus(task.status))
    .map((task) => ({
      ...task,
      dueDate: moved.has(task.id) ? (moved.get(task.id) ?? null) : task.dueDate,
    }));
  for (const milestone of facts.milestones) {
    if (milestone.status !== 'pending') continue;
    const due = latest(
      openTasks.filter((task) => task.milestoneId === milestone.id).map((task) => task.dueDate),
    );
    if (due && due > milestone.dueDate) {
      await stores.scopeChanges.moveMilestoneDueDate(milestone.id, due);
    }
  }
  const end = latest(openTasks.map((task) => task.dueDate));
  if (end && end > facts.plannedEndDate) {
    await stores.scopeChanges.extendProjectEnd(facts.projectId, end);
  }
}
