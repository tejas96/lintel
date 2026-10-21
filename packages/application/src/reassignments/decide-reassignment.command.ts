import { checkReassignmentDecision, type ReassignmentDecision } from '@lintel/domain';
import { NotFoundError, StaleVersionError } from '@lintel/shared';
import type { RequestContext } from '../common/request-context';
import type { ApplicationStores } from '../common/unit-of-work';
import { assignTaskOwner } from '../tasks/assign-task.command';
import { loadTaskForActor } from '../tasks/task-loader';
import { quoted } from '../tasks/task-records';
import type { ReassignmentRequestRecord } from './reassignment.store';
import { mayDecideReassignment } from './reassignment-deciders';
import {
  type ReassignmentDependencies,
  recordReassignmentStep,
  sendReassignmentNotice,
} from './reassignment-dependencies';
import { assertReassignmentAllowed } from './reassignment-errors';

export interface ReassignmentDecisionInput {
  readonly decision: ReassignmentDecision;
  /** Required to accept; defaults to the person the requester suggested. */
  readonly newOwnerUserId: string | null;
  readonly note: string | null;
  readonly version: number;
}

/**
 * The project manager accepts (the task moves through the normal assignment
 * path: audited, new owner notified, reminders started) or declines with a
 * note. The person who asked hears either way. Nobody decides their own request.
 */
export class DecideReassignmentCommand {
  constructor(private readonly deps: ReassignmentDependencies) {}

  async execute(
    context: RequestContext,
    requestId: string,
    input: ReassignmentDecisionInput,
  ): Promise<ReassignmentRequestRecord> {
    return this.deps.uow.transaction(async (stores) => {
      const request = await stores.reassignments.findForUpdate(requestId);
      if (!request) throw new NotFoundError('Reassignment request');
      const loaded = await loadTaskForActor(
        stores,
        context.actor,
        request.taskId,
        true,
        'Reassignment request',
      );
      const note = input.note?.trim() || null;
      const newOwnerUserId =
        input.decision === 'accepted' ? (input.newOwnerUserId ?? request.suggestedUserId) : null;
      assertReassignmentAllowed(
        checkReassignmentDecision(
          {
            status: request.status,
            requestedByUserId: request.requestedByUserId,
            currentOwnerUserId: loaded.task.ownerUserId,
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
            newOwnerUserId,
            note,
          },
        ),
      );
      if (request.version !== input.version) throw new StaleVersionError('This request');
      const resolved = await stores.reassignments.resolve(requestId, input.version, {
        status: input.decision,
        decidedByUserId: context.actor.userId,
        at: this.deps.clock.now(),
        note,
        newOwnerUserId,
      });
      if (!resolved) throw new StaleVersionError('This request');
      if (newOwnerUserId) {
        await assignTaskOwner(stores, this.deps.operations, context, request.taskId, {
          ownerUserId: newOwnerUserId,
          reason: note ?? `Reassignment requested: ${request.reason}`,
          version: loaded.task.version,
        });
      }
      const decided: ReassignmentRequestRecord = {
        ...request,
        status: input.decision,
        decidedByUserId: context.actor.userId,
        decisionNote: note,
        newOwnerUserId,
        version: request.version + 1,
      };
      await recordReassignmentStep(stores, context, request, {
        action: `reassignment_${input.decision}`,
        summary:
          input.decision === 'accepted'
            ? `Accepted the request to reassign ${quoted(loaded.task.title)}.`
            : `Declined the request to reassign ${quoted(loaded.task.title)}.`,
        after: { status: input.decision, newOwnerUserId, note },
      });
      await this.tellRequester(stores, context, decided, loaded.task.title);
      return decided;
    });
  }

  private async tellRequester(
    stores: ApplicationStores,
    context: RequestContext,
    request: ReassignmentRequestRecord,
    taskTitle: string,
  ): Promise<void> {
    const ids = [context.actor.userId, request.newOwnerUserId].filter(
      (id): id is string => id !== null,
    );
    const names = await stores.projects.userNames(ids);
    const decider = names.get(context.actor.userId) ?? 'The project manager';
    const newOwner = request.newOwnerUserId ? names.get(request.newOwnerUserId) : undefined;
    const accepted = request.status === 'accepted';
    const body = accepted
      ? `${decider} moved ${quoted(taskTitle)} to ${newOwner ?? 'someone else'}.${request.decisionNote ? ` ${request.decisionNote}` : ''}`
      : `${decider} kept ${quoted(taskTitle)} as it is: ${request.decisionNote ?? ''}`;
    const notifier = await this.deps.operations.notifierFor(stores);
    await sendReassignmentNotice(notifier, request, {
      kind: 'reassignment_decided',
      recipientUserId: request.requestedByUserId,
      title: accepted ? 'Reassignment accepted' : 'Reassignment declined',
      body,
      window: 'decision',
    });
  }
}
