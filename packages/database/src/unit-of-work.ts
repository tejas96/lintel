import type { ApplicationStores, UnitOfWork } from '@lintel/application';
import type { Database, DatabaseExecutor } from './client';
import { CapacityReadRepository } from './repositories/capacity-read.repository';
import { DeliverableRepository } from './repositories/deliverable.repository';
import { GuidanceRepository } from './repositories/guidance.repository';
import { IdentityRepository } from './repositories/identity.repository';
import { LeaveRepository } from './repositories/leave.repository';
import { LeaveTypeRepository } from './repositories/leave-type.repository';
import { NotificationRepository } from './repositories/notification.repository';
import { NotificationInboxRepository } from './repositories/notification-inbox.repository';
import { PeopleRepository } from './repositories/people.repository';
import { ProjectRepository } from './repositories/project.repository';
import { ProjectAccessRepository } from './repositories/project-access.repository';
import { ProjectCostRepository } from './repositories/project-cost.repository';
import { ProjectDocumentRepository } from './repositories/project-document.repository';
import { ReassignmentRepository } from './repositories/reassignment.repository';
import { RecordRepository } from './repositories/record.repository';
import { RewardRepository } from './repositories/reward.repository';
import { ScopeChangeRepository } from './repositories/scope-change.repository';
import { SettingsRepository } from './repositories/settings.repository';
import { TaskRepository } from './repositories/task.repository';
import { TaskItemRepository } from './repositories/task-item.repository';
import { TemplateRepository } from './repositories/template.repository';
import { TemplateUpdateRepository } from './repositories/template-update.repository';
import { WorkSessionRepository } from './repositories/work-session.repository';
import { WorkingCalendarRepository } from './repositories/working-calendar.repository';
import { createBackgroundStores } from './worker/background-stores';

/** Builds every repository on top of one executor (the pool or a transaction). */
export function createStores(executor: DatabaseExecutor): ApplicationStores {
  return {
    access: new ProjectAccessRepository(executor),
    background: createBackgroundStores(executor),
    capacity: new CapacityReadRepository(executor),
    guidance: new GuidanceRepository(executor),
    identity: new IdentityRepository(executor),
    inbox: new NotificationInboxRepository(executor),
    leave: new LeaveRepository(executor),
    notifications: new NotificationRepository(executor),
    people: new PeopleRepository(executor),
    projects: new ProjectRepository(executor),
    records: new RecordRepository(executor),
    scopeChanges: new ScopeChangeRepository(executor),
    rewards: new RewardRepository(executor),
    settings: new SettingsRepository(executor),
    templates: new TemplateRepository(executor),
    tasks: new TaskRepository(executor),
    taskItems: new TaskItemRepository(executor),
    workSessions: new WorkSessionRepository(executor),
    deliverables: new DeliverableRepository(executor),
    costs: new ProjectCostRepository(executor),
    leaveTypes: new LeaveTypeRepository(executor),
    calendars: new WorkingCalendarRepository(executor),
    documents: new ProjectDocumentRepository(executor),
    reassignments: new ReassignmentRepository(executor),
    templateUpdates: new TemplateUpdateRepository(executor),
  };
}

export class DrizzleUnitOfWork implements UnitOfWork<ApplicationStores> {
  readonly stores: ApplicationStores;

  constructor(private readonly db: Database) {
    this.stores = createStores(db);
  }

  transaction<T>(work: (stores: ApplicationStores) => Promise<T>): Promise<T> {
    return this.db.transaction((tx) => work(createStores(tx)));
  }
}
