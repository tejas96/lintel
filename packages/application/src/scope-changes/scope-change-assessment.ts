import type { TaskStatus } from '@lintel/domain';
import { type ErrorDetail, NotFoundError, ValidationFailedError } from '@lintel/shared';
import type { ApplicationStores } from '../common/unit-of-work';
import type {
  ProjectScheduleFacts,
  ScopeChangeCancellation,
  ScopeChangeImpact,
  ScopeChangeNewTask,
} from './scope-change.store';
import {
  assessScopeChange,
  isEmptyScopeChange,
  type ScopeChangeRequest,
  scopeChangeAdditionIssues,
} from './scope-change-additions';
import { type ScopeChangeImpactResult, scopeChangeShiftIssues } from './scope-change-impact';

export interface AssessedScopeChange {
  readonly facts: ProjectScheduleFacts;
  readonly result: ScopeChangeImpactResult;
  readonly impacts: ScopeChangeImpact[];
  readonly newTasks: ScopeChangeNewTask[];
  readonly cancellations: (ScopeChangeCancellation & { readonly taskTitle: string })[];
}

type Stores = Pick<ApplicationStores, 'scopeChanges' | 'settings' | 'access' | 'tasks'>;

/** New tasks go to active people who are already on the project. */
async function ownerIssues(
  stores: Stores,
  projectId: string,
  newTasks: readonly ScopeChangeNewTask[],
): Promise<ErrorDetail[]> {
  const owners = [
    ...new Set(newTasks.flatMap((task) => (task.ownerUserId ? [task.ownerUserId] : []))),
  ];
  if (owners.length === 0) return [];
  const active = await stores.tasks.activeUserIds(owners);
  const members = new Set<string>();
  for (const userId of owners) {
    const facts = await stores.access.accessFacts(projectId, userId);
    if (facts.projectRole !== null || facts.managerUserId === userId) members.add(userId);
  }
  return newTasks.flatMap((task, index): ErrorDetail[] => {
    if (!task.ownerUserId) return [];
    const field = `newTasks.${index}.ownerUserId`;
    if (!active.has(task.ownerUserId))
      return [{ field, message: 'Choose an active studio member.' }];
    if (!members.has(task.ownerUserId)) {
      return [{ field, message: 'Choose someone on this project. Add them to the team first.' }];
    }
    return [];
  });
}

/**
 * Checks a whole scope change request against the project and works out its
 * impact. Refuses empty changes, unknown or closed tasks, closed stages and
 * owners who are not on the project, each with the field it concerns.
 */
export async function assessScopeChangeRequest(
  stores: Stores,
  projectId: string,
  request: ScopeChangeRequest,
): Promise<AssessedScopeChange> {
  const facts = await stores.scopeChanges.scheduleFacts(projectId);
  if (!facts) throw new NotFoundError('Project');
  if (isEmptyScopeChange(request)) {
    throw new ValidationFailedError('Choose at least one change: move, add or cancel a task.', [
      { field: 'taskShifts', message: 'Nothing would change.' },
    ]);
  }
  const issues = [
    ...scopeChangeShiftIssues(facts, request.taskShifts),
    ...scopeChangeAdditionIssues(facts, await stores.scopeChanges.stagesOf(projectId), request),
    ...(await ownerIssues(stores, projectId, request.newTasks)),
  ];
  if (issues.length > 0) {
    throw new ValidationFailedError('Some task changes need attention.', issues);
  }
  const result = assessScopeChange(facts, request, await stores.settings.defaultCalendar());
  const statusById = new Map<string, { status: TaskStatus; title: string }>(
    facts.tasks.map((task) => [task.id, { status: task.status, title: task.title }]),
  );
  return {
    facts,
    result,
    impacts: result.impacts.map((impact) => ({
      taskId: impact.taskId,
      taskTitle: impact.taskTitle,
      currentDueDate: impact.currentDueDate,
      proposedDueDate: impact.proposedDueDate,
      shiftWorkingDays: impact.shiftWorkingDays,
      isDownstream: impact.isDownstream,
    })),
    newTasks: request.newTasks.map((task) => ({ ...task, title: task.title.trim() })),
    cancellations: request.cancelTaskIds.map((taskId) => ({
      taskId,
      statusAtProposal: statusById.get(taskId)?.status ?? 'ready',
      taskTitle: statusById.get(taskId)?.title ?? 'Task',
    })),
  };
}
