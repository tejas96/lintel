import { domainEvent } from '@lintel/domain';
import { ForbiddenError, InvalidTransitionError, StaleVersionError } from '@lintel/shared';
import type { RequestContext } from '../common/request-context';
import { canDecideLeaveRequest } from './leave-access';
import {
  currentStep,
  type LeaveDecision,
  type LeaveDecisionOutcome,
  resolveLeaveDecision,
} from './leave-approval-routing';
import { businessToday, type LeaveDependencies, type LeaveStores } from './leave-context';
import { assessLeaveImpact, conflictSnapshotOf } from './leave-impact.assessor';
import {
  assertNoBlockingProblems,
  type HandoverInput,
  periodOf,
  summaryFacts,
  validateHandovers,
} from './leave-input';
import {
  type LeaveSummaryFacts,
  leaveDecidedNotification,
  leaveInfoRequestedNotification,
  leaveRequestedNotification,
} from './leave-notifications';
import { loadVisibleLeaveRequest } from './leave-request.loader';

export interface LeaveDecisionInput {
  readonly decision: LeaveDecision;
  readonly note: string | null;
  readonly version: number;
}

export interface InfoResponseInput {
  readonly reason: string;
  readonly handovers: readonly HandoverInput[];
  readonly version: number;
}

const stale = () => new StaleVersionError('This leave request');

/** Approver decisions and the requester's answer to a question. One transaction each. */
export class DecideLeaveRequestCommands {
  constructor(private readonly deps: LeaveDependencies) {}

  async decide(context: RequestContext, requestId: string, input: LeaveDecisionInput) {
    const now = this.deps.clock.now();
    await this.deps.uow.transaction(async (stores) => {
      const loaded = await loadVisibleLeaveRequest(stores, context, requestId);
      const { request, requester, leaveType } = loaded;
      if (!canDecideLeaveRequest(context.actor, request)) {
        throw new ForbiddenError('Only the current approver can decide this request.');
      }
      if (request.version !== input.version) throw stale();
      const alreadyApproved = request.steps.some(
        (step) => step.status === 'approved' && step.decidedByUserId === context.actor.userId,
      );
      if (input.decision === 'approve' && alreadyApproved) {
        throw new ForbiddenError('A second approval must come from a different person.');
      }
      const outcome = resolveLeaveDecision(request.status, request.steps, input.decision);
      const finished = outcome.requestStatus === 'approved' || outcome.requestStatus === 'rejected';
      // The version guard runs first so a concurrent decision fails before touching any step.
      const updated = await stores.leave.updateRequest(request.id, request.version, {
        status: outcome.requestStatus,
        decisionNote: input.note,
        ...(finished ? { decidedAt: now } : {}),
      });
      if (!updated) throw stale();
      await this.applySteps(stores, outcome, {
        actorId: context.actor.userId,
        now,
        note: input.note,
      });
      await stores.records.appendAudit({
        actorUserId: context.actor.userId,
        action: `leave.${input.decision}`,
        entityType: 'leave_request',
        entityId: request.id,
        before: { status: request.status, level: outcome.decidedStep?.level ?? null },
        after: { status: outcome.requestStatus, note: input.note },
        requestId: context.requestId,
      });
      await stores.records.enqueueEvent(
        domainEvent('LeaveDecided', 'leave_request', request.id, {
          leaveRequestId: request.id,
          userId: request.userId,
          status: outcome.requestStatus,
        }),
      );
      await this.notifyDecision(stores, outcome, {
        requesterId: request.userId,
        facts: summaryFacts(request.id, requester, leaveType, request),
        note: input.note,
        version: request.version + 1,
      });
    });
  }

  private async applySteps(
    stores: LeaveStores,
    outcome: LeaveDecisionOutcome,
    decision: { actorId: string; now: Date; note: string | null },
  ): Promise<void> {
    if (outcome.decidedStep && outcome.decidedStepStatus) {
      await stores.leave.updateStep(outcome.decidedStep.id, {
        status: outcome.decidedStepStatus,
        decidedByUserId: decision.actorId,
        decidedAt: decision.now,
        note: decision.note,
      });
    }
    if (outcome.activatedStep) {
      await stores.leave.updateStep(outcome.activatedStep.id, { status: 'pending' });
    }
    for (const step of outcome.skippedSteps) {
      await stores.leave.updateStep(step.id, { status: 'skipped' });
    }
  }

  /** The next approver is asked; otherwise the requester hears the question or the outcome. */
  private async notifyDecision(
    stores: LeaveStores,
    outcome: LeaveDecisionOutcome,
    input: { requesterId: string; facts: LeaveSummaryFacts; note: string | null; version: number },
  ): Promise<void> {
    const notifier = await this.deps.notifierFor(stores);
    const next = outcome.activatedStep;
    if (next?.approverUserId) {
      await notifier.notify(
        leaveRequestedNotification(next.approverUserId, input.facts, `level-${next.level}`),
      );
    } else if (outcome.requestStatus === 'info_requested') {
      await notifier.notify(
        leaveInfoRequestedNotification(input.requesterId, input.facts, input.note, input.version),
      );
    } else if (outcome.requestStatus === 'approved' || outcome.requestStatus === 'rejected') {
      await notifier.notify(
        leaveDecidedNotification(
          input.requesterId,
          input.facts,
          outcome.requestStatus,
          input.note,
          input.version,
        ),
      );
    }
  }

  async respond(context: RequestContext, requestId: string, input: InfoResponseInput) {
    const now = this.deps.clock.now();
    await this.deps.uow.transaction(async (stores) => {
      const { request, requester, leaveType } = await loadVisibleLeaveRequest(
        stores,
        context,
        requestId,
      );
      if (request.userId !== context.actor.userId) {
        throw new ForbiddenError('Only the person who asked for leave can answer.');
      }
      if (request.status !== 'info_requested') {
        throw new InvalidTransitionError('Nobody is waiting for more information on this request.');
      }
      if (request.version !== input.version) throw stale();
      const impact = await assessLeaveImpact(stores, {
        subject: requester,
        leaveType,
        period: periodOf(request),
        reason: input.reason,
        isUrgentAbsence: false,
        excludeRequestId: request.id,
        today: await businessToday(stores.settings, this.deps.clock),
      });
      assertNoBlockingProblems(impact.blockingProblems);
      const handovers = await validateHandovers(stores, requester.id, input.handovers);
      const updated = await stores.leave.updateRequest(request.id, request.version, {
        status: 'pending',
        reason: input.reason,
        warnings: impact.warnings,
        conflictSnapshot: conflictSnapshotOf(impact, now),
      });
      if (!updated) throw stale();
      await stores.leave.removeUnappliedHandovers(request.id);
      await stores.leave.addHandovers(request.id, handovers);
      await stores.records.appendAudit({
        actorUserId: context.actor.userId,
        action: 'leave.info_provided',
        entityType: 'leave_request',
        entityId: request.id,
        after: { handovers: handovers.length },
        requestId: context.requestId,
      });
      const approver = currentStep(request.steps)?.approverUserId;
      if (approver) {
        const notifier = await this.deps.notifierFor(stores);
        await notifier.notify(
          leaveRequestedNotification(
            approver,
            summaryFacts(request.id, requester, leaveType, request),
            `response-v${request.version + 1}`,
          ),
        );
      }
    });
  }
}
