import {
  type Actor,
  DEFAULT_ROLE_CAPABILITIES,
  type DomainEvent,
  type ProjectRole,
  type Role,
  type TaskDependencyEdge,
} from '@lintel/domain';
import { type Clock, fixedClock, toCalendarDate } from '@lintel/shared';
import type { ActivityEntry, AuditEntry } from '../common/record.store';
import type { RequestContext } from '../common/request-context';
import type { UnitOfWork } from '../common/unit-of-work';
import type {
  DeliverableRecord,
  DeliverableVersionRecord,
  FileRecord,
} from '../deliverables/deliverable.store';
import type { NewNotification } from '../notifications/notification.store';
import { Notifier } from '../notifications/notifier';
import type { OperationsDependencies, OperationsStores } from '../tasks/operations-context';
import type { TaskRecord } from '../tasks/task.store';
import type { BlockerRecord, ChecklistItemRecord } from '../tasks/task-item.store';
import type { PriorityConflictRecord, WorkSessionRecord } from '../work/work-session.store';
import { buildOperationsStores } from './in-memory-operations.stores';

export interface FakeProject {
  readonly managerUserId: string;
  readonly ownerUserId: string;
  readonly members: Map<string, ProjectRole>;
}

/** Mutable state behind the in-memory stores. Transactions do not roll back. */
export class InMemoryOperationsWorld {
  clock: Clock;
  readonly projects = new Map<string, FakeProject>();
  readonly activeUsers = new Set<string>();
  readonly tasks = new Map<string, TaskRecord>();
  readonly collaborators = new Map<string, string[]>();
  edges: TaskDependencyEdge[] = [];
  readonly checklist: ChecklistItemRecord[] = [];
  readonly blockers: BlockerRecord[] = [];
  readonly sessions: WorkSessionRecord[] = [];
  readonly conflicts: PriorityConflictRecord[] = [];
  readonly files: FileRecord[] = [];
  readonly deliverables: DeliverableRecord[] = [];
  readonly versions: DeliverableVersionRecord[] = [];
  readonly notifications: NewNotification[] = [];
  readonly events: DomainEvent[] = [];
  readonly activity: ActivityEntry[] = [];
  readonly audit: AuditEntry[] = [];
  private sequence = 0;

  constructor(now = '2026-10-21T05:00:00Z') {
    this.clock = fixedClock(now);
  }

  nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}-${this.sequence}`;
  }

  setNow(instant: string): void {
    this.clock = fixedClock(instant);
  }

  addProject(id: string, managerUserId: string, members: Record<string, ProjectRole>): void {
    this.projects.set(id, {
      managerUserId,
      ownerUserId: 'owner',
      members: new Map([[managerUserId, 'manager'], ...Object.entries(members)]),
    });
    for (const userId of [managerUserId, ...Object.keys(members)]) this.activeUsers.add(userId);
  }

  addTask(task: Partial<TaskRecord> & { id: string; projectId: string }): TaskRecord {
    const record: TaskRecord = {
      stageId: null,
      milestoneId: null,
      parentTaskId: null,
      number: this.tasks.size + 1,
      title: task.id,
      description: null,
      status: 'ready',
      priority: 'medium',
      ownerUserId: null,
      reviewerUserId: null,
      plannedStartDate: null,
      dueDate: '2026-10-25',
      baselineDueDate: '2026-10-25',
      estimateMinutes: null,
      actualMinutes: 0,
      requiresReview: false,
      acknowledgedAt: null,
      completionCriteria: null,
      reviewRounds: 0,
      startedAt: null,
      submittedAt: null,
      completedAt: null,
      completedByUserId: null,
      cancelledReason: null,
      version: 1,
      ...task,
    };
    this.tasks.set(record.id, record);
    return record;
  }

  stores(): OperationsStores {
    return buildOperationsStores(this);
  }

  dependencies(today = '2026-10-21'): OperationsDependencies {
    const stores = this.stores();
    const uow: UnitOfWork<OperationsStores> = {
      stores,
      transaction: (work) => work(stores),
    };
    return {
      uow,
      clock: { now: () => this.clock.now() },
      context: {
        today: async () => toCalendarDate(today),
        notifierFor: async (notifierStores) =>
          new Notifier(notifierStores.notifications, notifierStores.records, this.clock, {
            timeZone: 'Asia/Kolkata',
            quietHoursStart: '21:00',
            quietHoursEnd: '08:00',
            smsConfigured: false,
          }),
      },
    };
  }
}

export function actorFor(userId: string, role: Role = 'employee'): Actor {
  return { userId, role, capabilities: new Set(DEFAULT_ROLE_CAPABILITIES[role]) };
}

export function contextFor(userId: string, role: Role = 'employee'): RequestContext {
  return { actor: actorFor(userId, role), sessionId: 'session', requestId: 'request' };
}
