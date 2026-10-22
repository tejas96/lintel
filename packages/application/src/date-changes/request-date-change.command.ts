import { checkDateChangeRequest, checkDateChangeWithdrawal } from '@lintel/domain';
import {
  formatCalendarDateWords,
  NotFoundError,
  StaleVersionError,
  toCalendarDate,
} from '@lintel/shared';
import { ProjectAccessService } from '../access/project-access.service';
import type { RequestContext } from '../common/request-context';
import type { ApplicationStores } from '../common/unit-of-work';
import { reassignmentDeciders } from '../reassignments/reassignment-deciders';
import { assertReassignmentAllowed as assertAllowed } from '../reassignments/reassignment-errors';
import type { LoadedTask } from '../tasks/task-loader';
import { loadTaskForActor } from '../tasks/task-loader';
import { quoted } from '../tasks/task-records';
import type { DateChangeRequestRecord } from './date-change.store';
import {
  type DateChangeDependencies,
  recordDateChangeStep,
  sendDateChangeNotice,
} from './date-change-dependencies';

export interface DateChangeAskInput {
  readonly reason: string;
  readonly proposedStartDate: string | null;
  readonly proposedDueDate: string;
}

/**
 * The owner of a task (or a collaborator) asks the project manager for new
 * dates with a reason; the person who asked may withdraw an open request.
 * Nothing moves until a manager accepts.
 */
export class RequestDateChangeCommands {
  constructor(private readonly deps: DateChangeDependencies) {}

  async request(
    context: RequestContext,
    taskId: string,
    input: DateChangeAskInput,
  ): Promise<DateChangeRequestRecord> {
    return this.deps.uow.transaction(async (stores) => {
      // Locking the task serialises two people asking at once (one open request per task).
      const loaded = await loadTaskForActor(stores, context.actor, taskId, true);
      const open = await stores.dateChanges.openForTask(taskId);
      const reason = input.reason.trim();
      const proposedDueDate = toCalendarDate(input.proposedDueDate);
      const proposedStartDate = input.proposedStartDate
        ? toCalendarDate(input.proposedStartDate)
        : null;
      assertAllowed(
        checkDateChangeRequest(
          {
            taskStatus: loaded.task.status,
            ownerUserId: loaded.task.ownerUserId,
            collaboratorUserIds: loaded.collaboratorUserIds,
            currentDueDate: loaded.task.dueDate ? toCalendarDate(loaded.task.dueDate) : null,
            hasOpenRequest: open !== null,
          },
          {
            requesterUserId: context.actor.userId,
            reason,
            proposedStartDate,
            proposedDueDate,
            today: await this.deps.operations.today(),
          },
        ),
      );
      const request = await stores.dateChanges.insert({
        taskId,
        projectId: loaded.task.projectId,
        requestedByUserId: context.actor.userId,
        previousStartDate: loaded.task.plannedStartDate,
        previousDueDate: loaded.task.dueDate,
        proposedStartDate,
        proposedDueDate,
        reason,
      });
      await recordDateChangeStep(stores, context, request, {
        action: 'date_change_requested',
        summary: `Asked for a new due date (${formatCalendarDateWords(proposedDueDate)}) for ${quoted(loaded.task.title)}.`,
        after: { status: 'open', proposedStartDate, proposedDueDate, reason },
      });
      await this.askDeciders(stores, context, request, loaded);
      return request;
    });
  }

  async withdraw(
    context: RequestContext,
    requestId: string,
    version: number,
  ): Promise<DateChangeRequestRecord> {
    return this.deps.uow.transaction(async (stores) => {
      const request = await stores.dateChanges.findForUpdate(requestId);
      if (!request) throw new NotFoundError('New-date request');
      await new ProjectAccessService(stores.access).requireView(
        context.actor,
        request.projectId,
        'New-date request',
      );
      assertAllowed(checkDateChangeWithdrawal(request, context.actor.userId));
      if (request.version !== version) throw new StaleVersionError('This request');
      const resolved = await stores.dateChanges.resolve(requestId, version, {
        status: 'withdrawn',
        decidedByUserId: null,
        at: this.deps.clock.now(),
        note: null,
      });
      if (!resolved) throw new StaleVersionError('This request');
      await recordDateChangeStep(stores, context, request, {
        action: 'date_change_withdrawn',
        summary: 'Withdrew a new-date request.',
        after: { status: 'withdrawn' },
      });
      return { ...request, status: 'withdrawn', version: request.version + 1 };
    });
  }

  /** The project manager (or the project owner when the manager asks; else studio-wide managers). */
  private async askDeciders(
    stores: ApplicationStores,
    context: RequestContext,
    request: DateChangeRequestRecord,
    loaded: LoadedTask,
  ): Promise<void> {
    const onProject = reassignmentDeciders(loaded.access, context.actor.userId);
    const deciders =
      onProject.length > 0
        ? onProject
        : (await stores.reassignments.activeUserIdsWithCapability('projects.manage_any')).filter(
            (userId) => userId !== context.actor.userId,
          );
    const names = await stores.projects.userNames([context.actor.userId]);
    const requester = names.get(context.actor.userId) ?? 'A team member';
    const notifier = await this.deps.operations.notifierFor(stores);
    for (const recipientUserId of deciders) {
      await sendDateChangeNotice(notifier, request, {
        kind: 'date_change_requested',
        recipientUserId,
        title: `New date for ${quoted(loaded.task.title)}?`,
        body: `${requester} asks to move the due date from ${request.previousDueDate ? formatCalendarDateWords(request.previousDueDate) : 'none'} to ${formatCalendarDateWords(request.proposedDueDate)}: ${request.reason}`,
        window: 'request',
      });
    }
  }
}
