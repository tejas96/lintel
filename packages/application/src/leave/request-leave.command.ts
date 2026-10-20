import { domainEvent } from '@lintel/domain';
import { NotFoundError, PreconditionFailedError } from '@lintel/shared';
import type { RequestContext } from '../common/request-context';
import { canRecordAbsenceFor, isInReportingLine } from './leave-access';
import { planApprovalSteps } from './leave-approval-routing';
import {
  activeManagerOf,
  businessToday,
  hasCapability,
  type LeaveDependencies,
  requireCapability,
  requirePerson,
} from './leave-context';
import { assessLeaveImpact, conflictSnapshotOf, type LeaveImpact } from './leave-impact.assessor';
import {
  assertNoBlockingProblems,
  type HandoverInput,
  type LeavePeriodInput,
  periodOf,
  requireLeaveType,
  summaryFacts,
  validateHandovers,
} from './leave-input';
import { handoverRequestedNotification, leaveRequestedNotification } from './leave-notifications';

export interface PreviewLeaveInput extends LeavePeriodInput {
  /** Someone else's absence (manager preview); null for my own leave. */
  readonly userId: string | null;
  readonly reason: string | null;
}

export interface SubmitLeaveInput extends LeavePeriodInput {
  readonly reason: string | null;
  readonly handovers: readonly HandoverInput[];
}

/** Previewing and submitting leave. Conflicts and warnings never reject leave on their own. */
export class RequestLeaveCommands {
  constructor(private readonly deps: LeaveDependencies) {}

  async preview(context: RequestContext, input: PreviewLeaveInput): Promise<LeaveImpact> {
    const stores = this.deps.uow.stores;
    const actorId = context.actor.userId;
    const subjectId = input.userId ?? actorId;
    if (subjectId === actorId) requireCapability(context, 'leave.request');
    const subject = await requirePerson(stores, subjectId);
    if (subjectId !== actorId) {
      const viewer = await requirePerson(stores, actorId);
      const allowed =
        hasCapability(context, 'leave.approve_any') ||
        canRecordAbsenceFor(
          { actor: context.actor, teamId: viewer.teamId },
          subject,
          await isInReportingLine(stores, subject, actorId),
        );
      if (!allowed) throw new NotFoundError('Person');
    }
    return assessLeaveImpact(stores, {
      subject,
      leaveType: await requireLeaveType(stores, input.leaveTypeId),
      period: periodOf(input),
      reason: input.reason,
      isUrgentAbsence: subjectId !== actorId,
      excludeRequestId: null,
      today: await businessToday(stores.settings, this.deps.clock),
    });
  }

  async submit(context: RequestContext, input: SubmitLeaveInput): Promise<{ id: string }> {
    requireCapability(context, 'leave.request');
    const now = this.deps.clock.now();
    return this.deps.uow.transaction(async (stores) => {
      const requester = await requirePerson(stores, context.actor.userId);
      if (requester.status !== 'active') {
        throw new PreconditionFailedError('Only active members can request leave.');
      }
      const leaveType = await requireLeaveType(stores, input.leaveTypeId);
      const period = periodOf(input);
      const impact = await assessLeaveImpact(stores, {
        subject: requester,
        leaveType,
        period,
        reason: input.reason,
        isUrgentAbsence: false,
        excludeRequestId: null,
        today: await businessToday(stores.settings, this.deps.clock),
      });
      assertNoBlockingProblems(impact.blockingProblems);
      const handovers = await validateHandovers(stores, requester.id, input.handovers);
      const steps = planApprovalSteps(
        { id: requester.id, activeManagerUserId: await activeManagerOf(stores, requester) },
        impact.approvalLevels,
        await stores.leave.approverDirectory(),
      );
      const { id } = await stores.leave.createRequest({
        userId: requester.id,
        leaveTypeId: leaveType.id,
        ...period,
        halfDayUnits: impact.halfDayUnits,
        reason: input.reason,
        status: 'pending',
        isUrgentAbsence: false,
        recordedByUserId: null,
        warnings: impact.warnings,
        conflictSnapshot: conflictSnapshotOf(impact, now),
        decidedAt: null,
      });
      await stores.leave.addSteps(id, steps);
      await stores.leave.addHandovers(id, handovers);
      await stores.records.appendAudit({
        actorUserId: requester.id,
        action: 'leave.requested',
        entityType: 'leave_request',
        entityId: id,
        after: {
          leaveTypeId: leaveType.id,
          startDate: period.startDate,
          endDate: period.endDate,
          halfDayUnits: impact.halfDayUnits,
          approvalLevels: impact.approvalLevels,
          conflicts: impact.conflicts.length,
        },
        requestId: context.requestId,
      });
      await stores.records.enqueueEvent(
        domainEvent('LeaveRequested', 'leave_request', id, {
          leaveRequestId: id,
          userId: requester.id,
        }),
      );
      const facts = summaryFacts(id, requester, leaveType, {
        ...period,
        halfDayUnits: impact.halfDayUnits,
      });
      const notifier = await this.deps.notifierFor(stores);
      const levelOne = steps[0]?.approverUserId;
      if (levelOne && levelOne !== requester.id) {
        await notifier.notify(leaveRequestedNotification(levelOne, facts, 'level-1'));
      }
      const tasks = await stores.leave.openTasksOf(requester.id);
      for (const handover of handovers) {
        const task = tasks.find((candidate) => candidate.taskId === handover.taskId);
        if (handover.toUserId && task) {
          await notifier.notify(
            handoverRequestedNotification(handover.toUserId, facts, task.taskId, task.title),
          );
        }
      }
      return { id };
    });
  }
}
