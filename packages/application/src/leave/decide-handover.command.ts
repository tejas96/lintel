import { domainEvent, handoverApplyProblem, isHandedBack } from '@lintel/domain';
import {
  ForbiddenError,
  InvalidTransitionError,
  NotFoundError,
  StaleVersionError,
  ValidationFailedError,
} from '@lintel/shared';
import { ProjectAccessService } from '../access/project-access.service';
import type { RequestContext } from '../common/request-context';
import type { LeaveHandoverRecord } from './leave.store';
import type { LeaveDependencies, LeaveStores } from './leave-context';
import { taskHandoverNotifications } from './leave-notifications';
import { loadVisibleLeaveRequest } from './leave-request.loader';

export interface HandoverDecisionInput {
  readonly decision: 'accept' | 'decline' | 'apply';
  /** For `apply`: someone other than the proposed person. */
  readonly toUserId: string | null;
}

/**
 * The proposed person accepts or declines; a manager of the task's project
 * applies the handover, which reassigns the task owner with a full audit trail.
 */
export class DecideHandoverCommand {
  constructor(private readonly deps: LeaveDependencies) {}

  /** Returns the leave request the handover belongs to. */
  async execute(
    context: RequestContext,
    handoverId: string,
    input: HandoverDecisionInput,
  ): Promise<{ leaveRequestId: string }> {
    const now = this.deps.clock.now();
    return this.deps.uow.transaction(async (stores) => {
      const handover = await stores.leave.findHandover(handoverId);
      if (!handover) throw new NotFoundError('Handover');
      const { request } = await loadVisibleLeaveRequest(stores, context, handover.leaveRequestId);
      if (input.decision === 'apply') {
        await this.apply(
          stores,
          context,
          { ...handover, absentUserId: request.userId },
          {
            overrideUserId: input.toUserId,
            now,
          },
        );
      } else {
        if (handover.toUserId !== context.actor.userId) {
          throw new ForbiddenError('Only the proposed person can accept or decline.');
        }
        if (handover.status !== 'proposed') {
          throw new InvalidTransitionError('This handover was already answered.');
        }
        const status = input.decision === 'accept' ? 'accepted' : 'declined';
        await stores.leave.updateHandover(handover.id, {
          status,
          decidedByUserId: context.actor.userId,
          decidedAt: now,
        });
        await stores.records.appendAudit({
          actorUserId: context.actor.userId,
          action: `leave.handover_${status}`,
          entityType: 'leave_handover',
          entityId: handover.id,
          after: { taskId: handover.taskId },
          requestId: context.requestId,
        });
      }
      return { leaveRequestId: handover.leaveRequestId };
    });
  }

  /**
   * Reassigns the task. An applied handover can be applied again only when the
   * task came back to the person on leave (for example a reassignment request
   * returned it); then the manager chooses cover once more.
   */
  private async apply(
    stores: LeaveStores,
    context: RequestContext,
    handover: LeaveHandoverRecord & { readonly absentUserId: string },
    input: { readonly overrideUserId: string | null; readonly now: Date },
  ): Promise<void> {
    await new ProjectAccessService(stores.access).requireManage(
      context.actor,
      handover.projectId,
      'Task',
    );
    const task = await stores.leave.handoverTask(handover.taskId);
    if (!task) throw new NotFoundError('Task');
    const ownership = { ...handover, taskOwnerUserId: task.ownerUserId };
    const problem = handoverApplyProblem(ownership);
    if (problem) throw new InvalidTransitionError(problem);
    // Handed back: the earlier choice no longer stands, so the manager names the person again.
    const handedBack = isHandedBack(ownership);
    const toUserId = input.overrideUserId ?? (handedBack ? null : handover.toUserId);
    const recipient = toUserId ? await stores.people.findById(toUserId) : null;
    if (recipient?.status !== 'active') {
      throw new ValidationFailedError('Choose an active person to take over the task.', [
        { field: 'toUserId', message: 'Choose who takes over.' },
      ]);
    }
    if (task.ownerUserId === recipient.id) {
      throw new ValidationFailedError('This person already owns the task.');
    }
    if (!(await stores.leave.reassignTaskOwner(task.id, task.version, recipient.id))) {
      throw new StaleVersionError('This task');
    }
    await stores.leave.ensureProjectMember(task.projectId, recipient.id);
    await stores.leave.updateHandover(handover.id, {
      status: 'applied',
      toUserId: recipient.id,
      decidedByUserId: context.actor.userId,
      decidedAt: input.now,
    });
    await stores.records.appendAudit({
      actorUserId: context.actor.userId,
      action: 'task.reassigned_for_leave',
      entityType: 'task',
      entityId: task.id,
      before: { ownerUserId: task.ownerUserId },
      after: { ownerUserId: recipient.id, handoverId: handover.id, handedBack },
      requestId: context.requestId,
    });
    await stores.records.appendActivity({
      projectId: task.projectId,
      taskId: task.id,
      actorUserId: context.actor.userId,
      type: 'task.reassigned',
      summary: `"${task.title}" was handed over to ${recipient.fullName} for a leave period.`,
      payload: { previousOwnerUserId: task.ownerUserId, handoverId: handover.id },
    });
    await stores.records.enqueueEvent(
      domainEvent('TaskAssigned', 'task', task.id, {
        taskId: task.id,
        projectId: task.projectId,
        ownerId: recipient.id,
        assignedBy: context.actor.userId,
      }),
    );
    const notifier = await this.deps.notifierFor(stores);
    await notifier.notifyMany(
      taskHandoverNotifications({
        taskId: task.id,
        taskTitle: task.title,
        handoverId: handover.id,
        previousOwnerUserId: task.ownerUserId,
        newOwnerUserId: recipient.id,
        window: handedBack ? `${handover.id}:${task.version}` : handover.id,
      }),
    );
  }
}
