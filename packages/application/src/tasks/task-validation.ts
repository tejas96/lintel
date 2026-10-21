import { validateEscalationDelay } from '@lintel/domain';
import { isTimeOfDay, PreconditionFailedError, ValidationFailedError } from '@lintel/shared';
import type { OperationsStores } from './operations-context';
import type { ProjectReferences, TaskRecord } from './task.store';

type TaskStores = Pick<OperationsStores, 'tasks'>;

/** Stage, milestone and parent task must belong to the task's own project. */
export async function assertReferencesInProject(
  stores: TaskStores,
  projectId: string,
  references: ProjectReferences,
): Promise<void> {
  const found = await stores.tasks.referencesInProject(projectId, references);
  const problems: { field: string; message: string }[] = [];
  if (references.stageId && !found.stage) {
    problems.push({ field: 'stageId', message: 'Choose a stage of this project.' });
  }
  if (references.milestoneId && !found.milestone) {
    problems.push({ field: 'milestoneId', message: 'Choose a milestone of this project.' });
  }
  if (references.taskId && !found.task) {
    problems.push({ field: 'parentTaskId', message: 'Choose a task of this project.' });
  }
  if (problems.length > 0) {
    throw new ValidationFailedError('Some references do not belong to this project.', problems);
  }
}

/** Every named person must exist and be active. */
export async function assertActivePeople(
  stores: TaskStores,
  people: readonly { readonly field: string; readonly userId: string | null | undefined }[],
): Promise<void> {
  const ids = people.map((person) => person.userId).filter((id): id is string => Boolean(id));
  if (ids.length === 0) return;
  const active = await stores.tasks.activeUserIds(ids);
  const problems = people
    .filter((person) => person.userId && !active.has(person.userId))
    .map((person) => ({ field: person.field, message: 'Choose an active studio member.' }));
  if (problems.length > 0) {
    throw new ValidationFailedError('Some people cannot be given this task.', problems);
  }
}

/** Nobody reviews their own work. */
export function assertReviewerIsNotOwner(
  ownerUserId: string | null,
  reviewerUserId: string | null,
): void {
  if (ownerUserId && reviewerUserId && ownerUserId === reviewerUserId) {
    throw new ValidationFailedError('The reviewer must be someone other than the owner.', [
      { field: 'reviewerUserId', message: 'Choose a different reviewer.' },
    ]);
  }
}

export function assertDateOrder(plannedStartDate: string | null, dueDate: string | null): void {
  if (plannedStartDate && dueDate && plannedStartDate > dueDate) {
    throw new ValidationFailedError('The planned start must be on or before the due date.', [
      { field: 'plannedStartDate', message: 'Start on or before the due date.' },
    ]);
  }
}

/** A due time is a 24-hour "HH:mm" and needs a due date to belong to. */
export function assertDueTime(dueDate: string | null, dueTime: string | null): void {
  if (dueTime === null) return;
  if (!isTimeOfDay(dueTime)) {
    throw new ValidationFailedError('Use a 24-hour time such as 11:00.', [
      { field: 'dueTime', message: 'Use a 24-hour time such as 11:00.' },
    ]);
  }
  if (dueDate === null) {
    throw new ValidationFailedError('A due time needs a due date.', [
      { field: 'dueTime', message: 'Choose the due date first.' },
    ]);
  }
}

/** Working days overdue before the project manager is alerted. */
export function assertEscalationDelay(workingDays: number): void {
  const problem = validateEscalationDelay(workingDays);
  if (problem) {
    throw new ValidationFailedError(problem, [
      { field: 'escalateAfterOverdueDays', message: problem },
    ]);
  }
}

/** Checklists and attachments of finished or cancelled tasks stay as they were. */
export function assertTaskOpen(task: Pick<TaskRecord, 'status'>, what: string): void {
  if (task.status === 'done' || task.status === 'cancelled') {
    throw new PreconditionFailedError(`This task is closed. Reopen it to change ${what}.`);
  }
}
