import { checkDateChangeDecision, type DateChangeDecision, domainEvent } from '@lintel/domain';
import {
  formatCalendarDateWords,
  NotFoundError,
  PreconditionFailedError,
  StaleVersionError,
} from '@lintel/shared';
import type { RequestContext } from '../common/request-context';
import type { ApplicationStores } from '../common/unit-of-work';
import { mayDecideReassignment } from '../reassignments/reassignment-deciders';
import { assertReassignmentAllowed as assertAllowed } from '../reassignments/reassignment-errors';
import { type AppliedMove, applyTaskMoves } from '../scheduling/apply-task-moves';
import type { TaskRecord } from '../tasks/task.store';
import { loadTaskForActor } from '../tasks/task-loader';
import { notifyAboutTask, quoted } from '../tasks/task-records';
import { deadlineText } from '../tasks/task-schedule-records';
import type { DateChangeRequestRecord } from './date-change.store';
import {
  type DateChangeDependencies,
  recordDateChangeStep,
  sendDateChangeNotice,
} from './date-change-dependencies';
import { acceptedStartDate, dateChangeImpact } from './date-change-impact';

export interface DateChangeDecisionInput {
  readonly decision: DateChangeDecision;
  readonly note: string | null;
  readonly version: number;
  /** On accept, also push the tasks that wait on this one (the impact preview's moves). */
  readonly moveWaitingTasks?: boolean | undefined;
}

/**
 * The project manager accepts (the task's dates move, schedule history and an
 * outbox event that re-plans its reminders are written; the baseline due date
 * never changes) or declines with a note. Accepting can also push the tasks
 * that wait on this one, with the timeline's knock-on rule, unless that
 * would move the agreed end (a scope change does that). The person who asked hears either
 * way, and so does the task owner when someone else asked.
 */
export class DecideDateChangeCommand {
  constructor(private readonly deps: DateChangeDependencies) {}

  async execute(
    context: RequestContext,
    requestId: string,
    input: DateChangeDecisionInput,
  ): Promise<DateChangeRequestRecord> {
    return this.deps.uow.transaction(async (stores) => {
      const request = await stores.dateChanges.findForUpdate(requestId);
      if (!request) throw new NotFoundError('New-date request');
      const loaded = await loadTaskForActor(
        stores,
        context.actor,
        request.taskId,
        true,
        'New-date request',
      );
      const note = input.note?.trim() || null;
      assertAllowed(
        checkDateChangeDecision(
          {
            status: request.status,
            requestedByUserId: request.requestedByUserId,
            taskStatus: loaded.task.status,
          },
          {
            deciderUserId: context.actor.userId,
            deciderManagesProject: mayDecideReassignment(
              loaded.access,
              context.actor.userId,
              request.requestedByUserId,
            ),
            decision: input.decision,
            note,
          },
        ),
      );
      if (request.version !== input.version) throw new StaleVersionError('This request');
      const resolved = await stores.dateChanges.resolve(requestId, input.version, {
        status: input.decision,
        decidedByUserId: context.actor.userId,
        at: this.deps.clock.now(),
        note,
      });
      if (!resolved) throw new StaleVersionError('This request');
      const pushed =
        input.decision === 'accepted'
          ? await this.accept(
              stores,
              context,
              request,
              loaded.task,
              input.moveWaitingTasks === true,
            )
          : [];
      const knockOn =
        pushed.length === 0
          ? ''
          : pushed.length === 1
            ? ' 1 waiting task moved with it.'
            : ` ${pushed.length} waiting tasks moved with it.`;
      const decided: DateChangeRequestRecord = {
        ...request,
        status: input.decision,
        decidedByUserId: context.actor.userId,
        decisionNote: note,
        version: request.version + 1,
      };
      await recordDateChangeStep(stores, context, request, {
        action: `date_change_${input.decision}`,
        summary:
          input.decision === 'accepted'
            ? `Moved ${quoted(loaded.task.title)} to ${formatCalendarDateWords(request.proposedDueDate)} as asked.${knockOn}`
            : `Declined the new date for ${quoted(loaded.task.title)}.`,
        after: {
          status: input.decision,
          note,
          dueDate: request.proposedDueDate,
          movedWaitingTaskIds: pushed.map((entry) => entry.after.id),
        },
      });
      await this.tell(stores, context, decided, loaded.task);
      return decided;
    });
  }

  /** Moves the task, and the work waiting on it when asked; returns the waiting tasks moved. */
  private async accept(
    stores: ApplicationStores,
    context: RequestContext,
    request: DateChangeRequestRecord,
    task: TaskRecord,
    moveWaitingTasks: boolean,
  ): Promise<AppliedMove[]> {
    const facts = moveWaitingTasks ? await stores.scopeChanges.scheduleFacts(task.projectId) : null;
    const impact = facts
      ? dateChangeImpact(facts, request, await stores.settings.defaultCalendar())
      : null;
    if (impact?.movingWaitingTasksNeedsScopeChange) {
      throw new PreconditionFailedError(
        `Moving the waiting tasks too would end the project after the agreed ${impact.plannedEndDate}. Accept only this task, or propose a scope change.`,
      );
    }
    await this.applyDates(stores, context, request, task);
    if (!impact || impact.dependentMoves.length === 0) return [];
    const why = `Moved because ${quoted(task.title)} got a new date: ${request.reason}`;
    const pushed = await applyTaskMoves(stores, context, impact.dependentMoves, {
      expectedVersions: new Map(),
      reasonFor: () => why,
    });
    const notifier = await this.deps.operations.notifierFor(stores);
    for (const { move, before, after } of pushed) {
      if (!move.committed) continue;
      await notifyAboutTask(notifier, context.actor.userId, after, `v${after.version}`, [
        {
          kind: 'priority_changed',
          recipientUserId: after.ownerUserId,
          title: `${quoted(after.title)} moved`,
          body: `Due ${deadlineText(before)} is now ${deadlineText(after)}. ${why}`,
        },
      ]);
    }
    return pushed;
  }

  private async applyDates(
    stores: ApplicationStores,
    context: RequestContext,
    request: DateChangeRequestRecord,
    task: TaskRecord,
  ): Promise<void> {
    const after = await stores.tasks.update(task.id, task.version, {
      plannedStartDate: acceptedStartDate(request, task),
      dueDate: request.proposedDueDate,
    });
    if (!after) throw new StaleVersionError('This task');
    await stores.tasks.recordScheduleChange({
      taskId: task.id,
      previousDueDate: task.dueDate,
      newDueDate: request.proposedDueDate,
      reason: `New date requested: ${request.reason}`,
      changedByUserId: context.actor.userId,
      dateChangeRequestId: request.id,
    });
    await stores.records.enqueueEvent(
      domainEvent('TaskScheduleChanged', 'task', task.id, {
        taskId: task.id,
        projectId: task.projectId,
        dueDate: request.proposedDueDate,
      }),
    );
  }

  private async tell(
    stores: ApplicationStores,
    context: RequestContext,
    request: DateChangeRequestRecord,
    task: TaskRecord,
  ): Promise<void> {
    const names = await stores.projects.userNames([context.actor.userId]);
    const decider = names.get(context.actor.userId) ?? 'The project manager';
    const accepted = request.status === 'accepted';
    const body = accepted
      ? `${decider} moved ${quoted(task.title)} to ${formatCalendarDateWords(request.proposedDueDate)}.${request.decisionNote ? ` ${request.decisionNote}` : ''}`
      : `${decider} kept ${quoted(task.title)} due ${request.previousDueDate ? formatCalendarDateWords(request.previousDueDate) : 'as planned'}: ${request.decisionNote ?? ''}`;
    const recipients = new Set([request.requestedByUserId, task.ownerUserId]);
    recipients.delete(context.actor.userId);
    const notifier = await this.deps.operations.notifierFor(stores);
    for (const recipientUserId of recipients) {
      if (!recipientUserId) continue;
      await sendDateChangeNotice(notifier, request, {
        kind: 'date_change_decided',
        recipientUserId,
        title: accepted ? 'New date accepted' : 'New date declined',
        body,
        window: 'decision',
      });
    }
  }
}
