import { DEFAULT_ROLE_CAPABILITIES, DEFAULT_WORKING_CALENDAR, type Role } from '@lintel/domain';
import { fixedClock } from '@lintel/shared';
import type { ProjectAccessStore } from '../access/project-access.store';
import type { AuditEntry, RecordStore } from '../common/record.store';
import type { RequestContext } from '../common/request-context';
import type { UnitOfWork } from '../common/unit-of-work';
import type { LeaveDependencies, LeaveStores } from '../leave/leave-context';
import type { NewNotification, NotificationStore } from '../notifications/notification.store';
import { Notifier } from '../notifications/notifier';
import type { PeopleStore, PersonRecord } from '../people/people.store';
import type { OrganizationSettings, SettingsStore } from '../settings/settings.store';
import { InMemoryLeaveStore } from './in-memory-leave.store';

/** 21 October 2026, 10:00 in Kolkata. */
export const TEST_NOW = '2026-10-21T04:30:00Z';

export const TEST_SETTINGS: OrganizationSettings = {
  name: 'Test studio',
  timeZone: 'Asia/Kolkata',
  currency: 'INR',
  projectReferencePrefix: 'TST',
  deadlineReminderTime: '10:00',
  defaultQuietHoursStart: '21:00',
  defaultQuietHoursEnd: '08:00',
  leaveSecondApprovalAboveHalfDays: 10,
  workTrackingEnabled: true,
  profitabilityEnabled: false,
};

function unused(): never {
  throw new Error('Not used by this test.');
}

export function fakeSettings(overrides: Partial<SettingsStore> = {}): SettingsStore {
  return {
    organization: async () => TEST_SETTINGS,
    updateOrganization: unused,
    defaultCalendar: async () => ({ id: 'cal', ...DEFAULT_WORKING_CALENDAR }),
    calendarsForUsers: async (ids) => new Map(ids.map((id) => [id, DEFAULT_WORKING_CALENDAR])),
    listHolidays: async () => [],
    addHoliday: unused,
    removeHoliday: unused,
    roleCapabilities: unused,
    replaceRoleCapabilities: unused,
    ...overrides,
  };
}

export class RecordedEffects implements RecordStore {
  readonly audits: AuditEntry[] = [];
  readonly events: string[] = [];
  readonly activity: string[] = [];
  async appendActivity(entry: { type: string }) {
    this.activity.push(entry.type);
  }
  async appendAudit(entry: AuditEntry) {
    this.audits.push(entry);
  }
  async enqueueEvent(event: { type: string }) {
    this.events.push(event.type);
  }
}

export class CollectedNotifications implements NotificationStore {
  readonly sent: NewNotification[] = [];
  async recipientContext(userId: string) {
    return {
      userId,
      quietHoursStart: null,
      quietHoursEnd: null,
      hasActiveDevice: false,
      preferences: [],
    };
  }
  async create(notification: NewNotification) {
    const duplicate = this.sent.some(
      (sent) =>
        sent.recipientUserId === notification.recipientUserId &&
        sent.dedupeKey === notification.dedupeKey,
    );
    if (duplicate) return null;
    this.sent.push(notification);
    return { id: `n${this.sent.length}` };
  }
  to(userId: string): string[] {
    return this.sent.filter((n) => n.recipientUserId === userId).map((n) => n.kind);
  }
}

export function fakePeople(people: PersonRecord[]): PeopleStore {
  return {
    findById: async (id) => people.find((person) => person.id === id) ?? null,
    phoneInUse: unused,
    teamExists: unused,
    create: unused,
    update: unused,
    setStatus: unused,
    createTeam: unused,
    teamNameInUse: unused,
  };
}

export function person(id: string, role: Role, extra: Partial<PersonRecord> = {}): PersonRecord {
  return {
    id,
    fullName: id,
    phoneE164: `+91900000${id.length}`,
    email: null,
    designation: null,
    role,
    teamId: 'design',
    reportsToUserId: null,
    capacityPercent: 100,
    status: 'active',
    version: 1,
    ...extra,
  };
}

export function contextFor(person: PersonRecord): RequestContext {
  return {
    actor: {
      userId: person.id,
      role: person.role,
      capabilities: new Set(DEFAULT_ROLE_CAPABILITIES[person.role]),
    },
    sessionId: 's',
    requestId: 'r',
  };
}

/**
 * A small studio: owner, administrator, project manager (reports to the
 * owner), team lead (reports to the PM) and two designers (report to the lead).
 */
export function leaveWorld(managerOfProject = 'pm') {
  const people = [
    person('owner', 'owner', { teamId: 'leadership' }),
    person('admin', 'administrator', { teamId: 'leadership', reportsToUserId: 'owner' }),
    person('pm', 'project_manager', { reportsToUserId: 'owner' }),
    person('lead', 'team_lead', { reportsToUserId: 'pm' }),
    person('ana', 'employee', { reportsToUserId: 'lead' }),
    person('dev', 'employee', { reportsToUserId: 'lead' }),
  ];
  const leave = new InMemoryLeaveStore();
  leave.directory = { ownerUserId: 'owner', delegateUserIds: ['admin'] };
  for (const member of people) {
    leave.fullNames.set(member.id, member.fullName);
    leave.teams.set(member.id, { teamId: member.teamId, reportsTo: member.reportsToUserId });
  }
  leave.types.push({
    id: 'earned',
    code: 'earned',
    name: 'Earned leave',
    colorIndex: 2,
    isActive: true,
    requiresReason: true,
    allowsHalfDay: false,
    minimumNoticeDays: 7,
    annualAllowanceHalfDays: 30,
  });
  const records = new RecordedEffects();
  const notifications = new CollectedNotifications();
  const access: ProjectAccessStore = {
    accessFacts: async (projectId, userId) => ({
      projectId,
      exists: true,
      projectRole: userId === managerOfProject ? 'manager' : null,
      managerUserId: managerOfProject,
      ownerUserId: 'owner',
    }),
    memberProjectIds: async () => [],
    projectIdOfTask: async () => 'project',
    projectIdOfDeliverable: async () => null,
    projectIdOfMilestone: async () => null,
  };
  const stores: LeaveStores = {
    leave,
    people: fakePeople(people),
    settings: fakeSettings(),
    records,
    notifications,
    access,
  };
  const uow: UnitOfWork<LeaveStores> = { stores, transaction: (work) => work(stores) };
  const clock = fixedClock(TEST_NOW);
  const deps: LeaveDependencies = {
    uow,
    clock,
    notifierFor: async (bound) =>
      new Notifier(bound.notifications, bound.records, clock, {
        timeZone: 'Asia/Kolkata',
        quietHoursStart: '21:00',
        quietHoursEnd: '08:00',
        smsConfigured: false,
      }),
  };
  const ctx = (id: string) => {
    const found = people.find((candidate) => candidate.id === id);
    if (!found) throw new Error(`No test person ${id}`);
    return contextFor(found);
  };
  return { people, leave, records, notifications, deps, ctx };
}
