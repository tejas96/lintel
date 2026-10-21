import { checkReassignmentRequest, checkReassignmentWithdrawal } from '@lintel/domain';
import { NotFoundError, StaleVersionError } from '@lintel/shared';
import { ProjectAccessService } from '../access/project-access.service';
import type { RequestContext } from '../common/request-context';
import type { ApplicationStores } from '../common/unit-of-work';
import { loadTaskForActor } from '../tasks/task-loader';
import { quoted } from '../tasks/task-records';
import { assertActivePeople } from '../tasks/task-validation';
import type { ReassignmentRequestRecord } from './reassignment.store';
import {
  type ReassignmentDependencies,
  recordReassignmentStep,
  sendReassignmentNotice,
} from './reassignment-dependencies';
import { assertReassignmentAllowed } from './reassignment-errors';

export interface ReassignmentAskInput {
  readonly reason: string;
  readonly suggestedUserId: string | null;
}

/**
 * Who decides: the project manager, or the project's owner when the manager
 * is the one asking. Nobody is asked to decide their own request.
 */
export function reassignmentDeciders(
  facts: { readonly managerUserId: string | null; readonly ownerUserId: string | null },
  requesterUserId: string,
): string[] {
  const first = facts.managerUserId !== requesterUserId ? facts.managerUserId : facts.ownerUserId;
  return first && first !== requesterUserId ? [first] : [];
}

/** The owner or a collaborator asks for a task to move to someone else; they may withdraw it. */
export class RequestReassignmentCommands {
  constructor(private readonly deps: ReassignmentDependencies) {}

  async request(
    context: RequestContext,
    taskId: string,
    input: ReassignmentAskInput,
  ): Promise<ReassignmentRequestRecord> {
    return this.deps.uow.transaction(async (stores) => {
      // Locking the task serialises two people asking at once (one open request per task).
      const loaded = await loadTaskForActor(stores, context.actor, taskId, true);
      const open = await stores.reassignments.openForTask(taskId);
      const reason = input.reason.trim();
      assertReassignmentAllowed(
        checkReassignmentRequest(
          {
            taskStatus: loaded.task.status,
            ownerUserId: loaded.task.ownerUserId,
            collaboratorUserIds: loaded.collaboratorUserIds,
            hasOpenRequest: open !== null,
          },
          { requesterUserId: context.actor.userId, reason, suggestedUserId: input.suggestedUserId },
        ),
      );
      await assertActivePeople(stores, [
        { field: 'suggestedUserId', userId: input.suggestedUserId },
      ]);
      const request = await stores.reassignments.insert({
        taskId,
        projectId: loaded.task.projectId,
        requestedByUserId: context.actor.userId,
        ownerAtRequestUserId: loaded.task.ownerUserId,
        suggestedUserId: input.suggestedUserId,
        reason,
      });
      await recordReassignmentStep(stores, context, request, {
        action: 'reassignment_requested',
        summary: `Asked for ${quoted(loaded.task.title)} to be reassigned.`,
        after: { status: 'open', suggestedUserId: input.suggestedUserId, reason },
      });
      await this.askDeciders(stores, context, request, loaded.task.title, loaded.access);
      return request;
    });
  }

  async withdraw(
    context: RequestContext,
    requestId: string,
    version: number,
  ): Promise<ReassignmentRequestRecord> {
    return this.deps.uow.transaction(async (stores) => {
      const request = await stores.reassignments.findForUpdate(requestId);
      if (!request) throw new NotFoundError('Reassignment request');
      await new ProjectAccessService(stores.access).requireView(
        context.actor,
        request.projectId,
        'Reassignment request',
      );
      assertReassignmentAllowed(checkReassignmentWithdrawal(request, context.actor.userId));
      if (request.version !== version) throw new StaleVersionError('This request');
      const resolved = await stores.reassignments.resolve(requestId, version, {
        status: 'withdrawn',
        decidedByUserId: null,
        at: this.deps.clock.now(),
        note: null,
        newOwnerUserId: null,
      });
      if (!resolved) throw new StaleVersionError('This request');
      await recordReassignmentStep(stores, context, request, {
        action: 'reassignment_withdrawn',
        summary: 'Withdrew a reassignment request.',
        after: { status: 'withdrawn' },
      });
      return { ...request, status: 'withdrawn', version: request.version + 1 };
    });
  }

  private async askDeciders(
    stores: ApplicationStores,
    context: RequestContext,
    request: ReassignmentRequestRecord,
    taskTitle: string,
    facts: { readonly managerUserId: string | null; readonly ownerUserId: string | null },
  ): Promise<void> {
    const deciders = reassignmentDeciders(facts, context.actor.userId);
    if (deciders.length === 0) return;
    const names = await stores.projects.userNames([context.actor.userId]);
    const requester = names.get(context.actor.userId) ?? 'A team member';
    const notifier = await this.deps.operations.notifierFor(stores);
    for (const recipientUserId of deciders) {
      await sendReassignmentNotice(notifier, request, {
        kind: 'reassignment_requested',
        recipientUserId,
        title: `Reassign ${quoted(taskTitle)}?`,
        body: `${requester} asked for this task to move to someone else: ${request.reason}`,
        window: 'request',
      });
    }
  }
}
