import type { ProjectAccessStore } from '../access/project-access.store';
import type { BackgroundStores } from '../background/background.stores';
import type { WorkingCalendarStore } from '../calendars/working-calendar.store';
import type { DeliverableStore } from '../deliverables/deliverable.store';
import type { ProjectCostStore } from '../finances/project-cost.store';
import type { IdentityStore } from '../identity/identity.store';
import type { LeaveStore } from '../leave/leave.store';
import type { LeaveTypeStore } from '../leave-policies/leave-type.store';
import type { NotificationStore } from '../notifications/notification.store';
import type { NotificationInboxStore } from '../notifications/notification-inbox.store';
import type { CapacityReadStore } from '../operations/capacity.store';
import type { PeopleStore } from '../people/people.store';
import type { ProjectStore } from '../projects/project.store';
import type { RewardStore } from '../rewards/reward.store';
import type { ScopeChangeStore } from '../scope-changes/scope-change.store';
import type { SettingsStore } from '../settings/settings.store';
import type { TaskStore } from '../tasks/task.store';
import type { TaskItemStore } from '../tasks/task-item.store';
import type { TemplateStore } from '../templates/template.store';
import type { WorkSessionStore } from '../work/work-session.store';
import type { RecordStore } from './record.store';

/**
 * Every persistence port, bound to one database transaction. Feature modules
 * add their store here; use cases depend only on the stores they use.
 */
export interface ApplicationStores {
  readonly access: ProjectAccessStore;
  /** Worker-only stores (outbox relay, reminders, push delivery). */
  readonly background: BackgroundStores;
  readonly capacity: CapacityReadStore;
  readonly identity: IdentityStore;
  readonly inbox: NotificationInboxStore;
  readonly leave: LeaveStore;
  readonly notifications: NotificationStore;
  readonly people: PeopleStore;
  readonly projects: ProjectStore;
  readonly records: RecordStore;
  readonly scopeChanges: ScopeChangeStore;
  readonly rewards: RewardStore;
  readonly settings: SettingsStore;
  readonly templates: TemplateStore;
  readonly tasks: TaskStore;
  readonly taskItems: TaskItemStore;
  readonly workSessions: WorkSessionStore;
  readonly deliverables: DeliverableStore;
  readonly costs: ProjectCostStore;
  readonly leaveTypes: LeaveTypeStore;
  readonly calendars: WorkingCalendarStore;
}

/** Runs work atomically: every store write commits together or not at all. */
export interface UnitOfWork<TStores = ApplicationStores> {
  transaction<T>(work: (stores: TStores) => Promise<T>): Promise<T>;
  /** Stores outside a transaction, for reads and single-statement writes. */
  readonly stores: TStores;
}
