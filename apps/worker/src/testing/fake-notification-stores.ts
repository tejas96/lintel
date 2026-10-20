import type {
  ActivityEntry,
  AuditEntry,
  NewNotification,
  NotificationRecipientContext,
  NotificationStore,
  OrganizationSettings,
  PlannedDelivery,
  RecordStore,
  SettingsStore,
} from '@lintel/application';
import { DEFAULT_WORKING_CALENDAR, type DomainEvent, type WorkingCalendar } from '@lintel/domain';

export interface StoredNotification extends NewNotification {
  readonly id: string;
  readonly deliveries: readonly PlannedDelivery[];
}

/** In-memory NotificationStore with the real dedupe rule (recipient + key). */
export class FakeNotificationStore implements NotificationStore {
  readonly created: StoredNotification[] = [];
  readonly activeUsers = new Set<string>();
  readonly usersWithDevices = new Set<string>();

  async recipientContext(userId: string): Promise<NotificationRecipientContext | null> {
    if (!this.activeUsers.has(userId)) return null;
    return {
      userId,
      quietHoursStart: null,
      quietHoursEnd: null,
      hasActiveDevice: this.usersWithDevices.has(userId),
      preferences: [],
    };
  }

  async create(notification: NewNotification, deliveries: readonly PlannedDelivery[]) {
    const duplicate = this.created.some(
      (existing) =>
        existing.recipientUserId === notification.recipientUserId &&
        existing.dedupeKey === notification.dedupeKey,
    );
    if (duplicate) return null;
    const id = `notification-${this.created.length + 1}`;
    this.created.push({ ...notification, id, deliveries });
    return { id };
  }
}

export class FakeRecordStore implements RecordStore {
  readonly activities: ActivityEntry[] = [];
  readonly audits: AuditEntry[] = [];
  readonly events: DomainEvent[] = [];

  async appendActivity(entry: ActivityEntry) {
    this.activities.push(entry);
  }

  async appendAudit(entry: AuditEntry) {
    this.audits.push(entry);
  }

  async enqueueEvent(event: DomainEvent) {
    this.events.push(event);
  }
}

export const TEST_ORGANIZATION: OrganizationSettings = {
  name: 'Test studio',
  timeZone: 'Asia/Kolkata',
  currency: 'INR',
  projectReferencePrefix: 'TST',
  deadlineReminderTime: '10:00',
  defaultQuietHoursStart: '21:00',
  defaultQuietHoursEnd: '08:00',
  leaveSecondApprovalAboveHalfDays: 10,
  workTrackingEnabled: true,
};

type WorkerSettingsStore = Pick<
  SettingsStore,
  'organization' | 'defaultCalendar' | 'calendarsForUsers'
>;

export class FakeSettingsStore implements WorkerSettingsStore {
  organizationSettings: OrganizationSettings = TEST_ORGANIZATION;
  calendar: WorkingCalendar = DEFAULT_WORKING_CALENDAR;
  readonly personalCalendars = new Map<string, WorkingCalendar>();

  async organization() {
    return this.organizationSettings;
  }

  async defaultCalendar() {
    return { id: 'calendar-default', ...this.calendar };
  }

  async calendarsForUsers(userIds: readonly string[]) {
    const result = new Map<string, WorkingCalendar>();
    for (const userId of userIds) {
      result.set(userId, this.personalCalendars.get(userId) ?? this.calendar);
    }
    return result;
  }
}
