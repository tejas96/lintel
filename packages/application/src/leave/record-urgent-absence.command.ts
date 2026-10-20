import { domainEvent } from '@lintel/domain';
import { NotFoundError, PreconditionFailedError } from '@lintel/shared';
import type { RequestContext } from '../common/request-context';
import { canRecordAbsenceFor } from './leave-access';
import {
  businessToday,
  type LeaveDependencies,
  requireCapability,
  requirePerson,
} from './leave-context';
import { assessLeaveImpact, conflictSnapshotOf, type LeaveImpact } from './leave-impact.assessor';
import {
  assertNoBlockingProblems,
  type LeavePeriodInput,
  periodOf,
  requireLeaveType,
  summaryFacts,
} from './leave-input';
import { absenceReassessmentNotification, leaveDecidedNotification } from './leave-notifications';

export interface UrgentAbsenceInput extends LeavePeriodInput {
  readonly userId: string;
  readonly reason: string;
}

/** Affected task titles grouped by the project manager who must re-plan them. */
function workByManager(impact: LeaveImpact): Map<string, string[]> {
  const grouped = new Map<string, string[]>();
  for (const task of impact.affectedWork) {
    const titles = grouped.get(task.projectManagerUserId) ?? [];
    titles.push(`${task.title} (${task.projectName})`);
    grouped.set(task.projectManagerUserId, titles);
  }
  return grouped;
}

/**
 * A manager records an unplanned absence. It is approved immediately, the
 * managers of every affected project are asked to reassess, and no task is
 * ever reassigned automatically.
 */
export class RecordUrgentAbsenceCommand {
  constructor(private readonly deps: LeaveDependencies) {}

  async execute(context: RequestContext, input: UrgentAbsenceInput): Promise<{ id: string }> {
    requireCapability(context, 'leave.record_absence');
    const now = this.deps.clock.now();
    return this.deps.uow.transaction(async (stores) => {
      const subject = await stores.people.findById(input.userId);
      const recorder = await requirePerson(stores, context.actor.userId);
      const viewer = { actor: context.actor, teamId: recorder.teamId };
      if (!subject || !canRecordAbsenceFor(viewer, subject)) throw new NotFoundError('Person');
      if (subject.status !== 'active') {
        throw new PreconditionFailedError('Absences can only be recorded for active members.');
      }
      const leaveType = await requireLeaveType(stores, input.leaveTypeId);
      const period = periodOf(input);
      const impact = await assessLeaveImpact(stores, {
        subject,
        leaveType,
        period,
        reason: input.reason,
        isUrgentAbsence: true,
        excludeRequestId: null,
        today: await businessToday(stores.settings, this.deps.clock),
      });
      assertNoBlockingProblems(impact.blockingProblems);
      const { id } = await stores.leave.createRequest({
        userId: subject.id,
        leaveTypeId: leaveType.id,
        ...period,
        halfDayUnits: impact.halfDayUnits,
        reason: input.reason,
        status: 'approved',
        isUrgentAbsence: true,
        recordedByUserId: recorder.id,
        warnings: impact.warnings,
        conflictSnapshot: conflictSnapshotOf(impact, now),
        decidedAt: now,
      });
      await stores.leave.addSteps(id, [
        {
          level: 1,
          approverUserId: recorder.id,
          status: 'approved',
          decidedByUserId: recorder.id,
          decidedAt: now,
          note: 'Recorded as an urgent absence.',
        },
      ]);
      await stores.records.appendAudit({
        actorUserId: recorder.id,
        action: 'leave.absence_recorded',
        entityType: 'leave_request',
        entityId: id,
        after: {
          userId: subject.id,
          startDate: period.startDate,
          endDate: period.endDate,
          affectedTasks: impact.affectedWork.map((task) => task.taskId),
        },
        requestId: context.requestId,
      });
      await stores.records.enqueueEvent(
        domainEvent('UrgentAbsenceRecorded', 'leave_request', id, {
          leaveRequestId: id,
          userId: subject.id,
        }),
      );
      const facts = summaryFacts(id, subject, leaveType, {
        ...period,
        halfDayUnits: impact.halfDayUnits,
      });
      const notifier = await this.deps.notifierFor(stores);
      // Every affected project's manager gets the list, the recorder included: it is their to-do list.
      for (const [managerId, titles] of workByManager(impact)) {
        await notifier.notify(absenceReassessmentNotification(managerId, facts, titles));
      }
      if (subject.id !== recorder.id) {
        await notifier.notify(leaveDecidedNotification(subject.id, facts, 'approved', null, 1));
      }
      return { id };
    });
  }
}
