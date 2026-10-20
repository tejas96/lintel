import type { LeaveStatus } from '@lintel/domain';
import type { CalendarDate } from '@lintel/shared';
import type {
  ApproverDirectory,
  HandoverChange,
  LeaveHandoverRecord,
  LeaveRequestChange,
  LeaveStepChange,
  LeaveStepRecord,
  LeaveStore,
  LeaveTypeRecord,
  LeaveWorkItem,
  NewHandover,
  NewLeaveRequest,
  NewLeaveStep,
} from '../leave/leave.store';

type StoredRequest = NewLeaveRequest & {
  id: string;
  version: number;
  decisionNote: string | null;
  cancelledAt: Date | null;
};
type StoredHandover = LeaveHandoverRecord & { note: string | null };

/** Test double for LeaveStore with the same version-guard semantics as SQL. */
export class InMemoryLeaveStore implements LeaveStore {
  readonly types: LeaveTypeRecord[] = [];
  readonly requests: StoredRequest[] = [];
  readonly steps: (LeaveStepRecord & { leaveRequestId: string; note: string | null })[] = [];
  readonly handovers: StoredHandover[] = [];
  readonly work: (LeaveWorkItem & { ownerUserId: string; version: number })[] = [];
  readonly fullNames = new Map<string, string>();
  readonly teams = new Map<string, { teamId: string | null; reportsTo: string | null }>();
  directory: ApproverDirectory = { ownerUserId: null, delegateUserIds: [] };
  private sequence = 0;

  private nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}-${this.sequence}`;
  }

  async findLeaveType(id: string) {
    return this.types.find((type) => type.id === id) ?? null;
  }
  async activeLeaveTypes() {
    return this.types.filter((type) => type.isActive);
  }
  async findRequest(id: string) {
    const request = this.requests.find((candidate) => candidate.id === id);
    if (!request) return null;
    return {
      ...request,
      steps: this.steps
        .filter((step) => step.leaveRequestId === id)
        .sort((left, right) => left.level - right.level),
      handovers: this.handovers.filter((handover) => handover.leaveRequestId === id),
    };
  }
  async findHandover(id: string) {
    return this.handovers.find((handover) => handover.id === id) ?? null;
  }
  async personRequests(
    userId: string,
    range: { start: CalendarDate; end: CalendarDate },
    statuses: readonly LeaveStatus[],
  ) {
    return this.requests.filter(
      (request) =>
        request.userId === userId &&
        statuses.includes(request.status) &&
        request.startDate <= range.end &&
        request.endDate >= range.start,
    );
  }
  async teamAbsences(input: {
    userId: string;
    teamId: string | null;
    reportsToUserId: string | null;
    start: CalendarDate;
    end: CalendarDate;
  }) {
    return this.requests
      .filter((request) => {
        const facts = this.teams.get(request.userId);
        const related =
          (input.teamId !== null && facts?.teamId === input.teamId) ||
          (input.reportsToUserId !== null && facts?.reportsTo === input.reportsToUserId);
        return (
          request.userId !== input.userId &&
          related &&
          ['pending', 'info_requested', 'approved'].includes(request.status) &&
          request.startDate <= input.end &&
          request.endDate >= input.start
        );
      })
      .map((request) => ({ ...request, fullName: this.fullNames.get(request.userId) ?? '?' }));
  }
  async openTasksOf(userId: string) {
    return this.work.filter((task) => task.ownerUserId === userId);
  }
  async approverDirectory() {
    return this.directory;
  }
  async createRequest(input: NewLeaveRequest) {
    const id = this.nextId('leave');
    this.requests.push({ ...input, id, version: 1, decisionNote: null, cancelledAt: null });
    return { id };
  }
  async addSteps(requestId: string, steps: readonly NewLeaveStep[]) {
    for (const step of steps) {
      this.steps.push({
        id: this.nextId('step'),
        leaveRequestId: requestId,
        level: step.level,
        approverUserId: step.approverUserId,
        status: step.status,
        note: step.note ?? null,
      });
    }
  }
  async addHandovers(requestId: string, handovers: readonly NewHandover[]) {
    for (const handover of handovers) {
      const task = this.work.find((candidate) => candidate.taskId === handover.taskId);
      this.handovers.push({
        id: this.nextId('handover'),
        leaveRequestId: requestId,
        taskId: handover.taskId,
        taskTitle: task?.title ?? '?',
        projectId: task?.projectId ?? '?',
        projectManagerUserId: task?.projectManagerUserId ?? '?',
        toUserId: handover.toUserId,
        note: handover.note,
        status: 'proposed',
      });
    }
  }
  async removeUnappliedHandovers(requestId: string) {
    const keep = this.handovers.filter(
      (handover) => handover.leaveRequestId !== requestId || handover.status === 'applied',
    );
    this.handovers.splice(0, this.handovers.length, ...keep);
  }
  async updateRequest(id: string, expectedVersion: number, change: LeaveRequestChange) {
    const request = this.requests.find((candidate) => candidate.id === id);
    if (!request || request.version !== expectedVersion) return false;
    Object.assign(request, change, { version: request.version + 1 });
    return true;
  }
  async updateStep(stepId: string, change: LeaveStepChange) {
    const step = this.steps.find((candidate) => candidate.id === stepId);
    if (step) Object.assign(step, { status: change.status, note: change.note ?? step.note });
  }
  async updateHandover(id: string, change: HandoverChange) {
    const handover = this.handovers.find((candidate) => candidate.id === id);
    if (handover)
      Object.assign(handover, {
        status: change.status,
        toUserId: change.toUserId ?? handover.toUserId,
      });
  }
  async handoverTask(taskId: string) {
    const task = this.work.find((candidate) => candidate.taskId === taskId);
    return task
      ? {
          id: task.taskId,
          projectId: task.projectId,
          title: task.title,
          ownerUserId: task.ownerUserId,
          version: task.version,
        }
      : null;
  }
  async reassignTaskOwner(taskId: string, expectedVersion: number, ownerUserId: string) {
    const task = this.work.find((candidate) => candidate.taskId === taskId);
    if (!task || task.version !== expectedVersion) return false;
    Object.assign(task, { ownerUserId, version: task.version + 1 });
    return true;
  }
  async ensureProjectMember() {}
}
