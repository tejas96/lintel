import { CAPABILITIES, type Capability, type Role } from '@lintel/domain';
import {
  type Clock,
  ForbiddenError,
  isCalendarDate,
  isValidTimeZone,
  NotFoundError,
  ValidationFailedError,
} from '@lintel/shared';
import { requireCapability } from '../common/capability-guard';
import type { RequestContext } from '../common/request-context';
import type { ApplicationStores, UnitOfWork } from '../common/unit-of-work';
import { closeAllWorkSessions } from '../work/work-tracking';
import type { HolidayRecord, OrganizationSettings } from './settings.store';

type SettingsStores = Pick<ApplicationStores, 'settings' | 'records' | 'workSessions' | 'tasks'>;

/** Keeps the order of the domain list so stored grants are stable and readable. */
function orderedCapabilities(granted: Iterable<Capability>): Capability[] {
  const set = new Set(granted);
  return CAPABILITIES.filter((capability) => set.has(capability));
}

/** Studio settings, role grants and the holiday calendar. Every change is audited. */
export class ManageSettingsCommands {
  constructor(
    private readonly uow: UnitOfWork<SettingsStores>,
    private readonly clock: Clock,
  ) {}

  async updateOrganization(
    context: RequestContext,
    settings: OrganizationSettings,
  ): Promise<OrganizationSettings> {
    requireCapability(context, 'organization.manage_settings');
    const issues = [
      ...(isValidTimeZone(settings.timeZone)
        ? []
        : [{ field: 'timeZone', message: 'Use an IANA timezone such as Asia/Kolkata.' }]),
      ...(/^[A-Z]{3}$/.test(settings.currency)
        ? []
        : [{ field: 'currency', message: 'Use a three-letter ISO currency code such as INR.' }]),
    ];
    if (issues.length > 0) throw new ValidationFailedError('Check the studio settings.', issues);
    return this.uow.transaction(async (stores) => {
      const before = await stores.settings.organization();
      const after = await stores.settings.updateOrganization(settings);
      const trackingStops = before.workTrackingEnabled && !after.workTrackingEnabled;
      const closedWorkSessions = trackingStops
        ? await closeAllWorkSessions(stores, this.clock.now())
        : 0;
      await stores.records.appendAudit({
        actorUserId: context.actor.userId,
        action: 'organization.updated',
        entityType: 'organization',
        entityId: null,
        before: { ...before },
        after: { ...after, ...(trackingStops ? { closedWorkSessions } : {}) },
        requestId: context.requestId,
      });
      return after;
    });
  }

  /**
   * Replaces a role's capabilities. The owner role always keeps every
   * capability, and people can only grant capabilities they hold themselves.
   */
  async updateRoleCapabilities(
    context: RequestContext,
    role: Role,
    requested: readonly Capability[],
  ): Promise<Capability[]> {
    requireCapability(context, 'roles.manage');
    const capabilities = role === 'owner' ? [...CAPABILITIES] : orderedCapabilities(requested);
    return this.uow.transaction(async (stores) => {
      const current = (await stores.settings.roleCapabilities()).find((row) => row.role === role);
      const before = new Set(current?.capabilities ?? []);
      const escalations = capabilities.filter(
        (capability) => !before.has(capability) && !context.actor.capabilities.has(capability),
      );
      if (escalations.length > 0) {
        throw new ForbiddenError(
          `You can only grant capabilities you hold yourself: ${escalations.join(', ')}.`,
        );
      }
      await stores.settings.replaceRoleCapabilities(role, capabilities);
      await stores.records.appendAudit({
        actorUserId: context.actor.userId,
        action: 'roles.capabilities_changed',
        entityType: 'role',
        entityId: role,
        before: { capabilities: orderedCapabilities(before) },
        after: { capabilities },
        requestId: context.requestId,
      });
      return capabilities;
    });
  }

  async addHoliday(context: RequestContext, date: string, name: string): Promise<HolidayRecord> {
    requireCapability(context, 'organization.manage_settings');
    if (!isCalendarDate(date)) {
      throw new ValidationFailedError('Use a real date.', [
        { field: 'date', message: 'Use a real date in YYYY-MM-DD format.' },
      ]);
    }
    return this.uow.transaction(async (stores) => {
      const holiday = await stores.settings.addHoliday(date, name);
      await stores.records.appendAudit({
        actorUserId: context.actor.userId,
        action: 'holiday.added',
        entityType: 'holiday',
        entityId: holiday.id,
        after: { date: holiday.date, name: holiday.name },
        requestId: context.requestId,
      });
      return holiday;
    });
  }

  async removeHoliday(context: RequestContext, holidayId: string): Promise<void> {
    requireCapability(context, 'organization.manage_settings');
    await this.uow.transaction(async (stores) => {
      const holiday = (await stores.settings.listHolidays()).find((row) => row.id === holidayId);
      if (!holiday) throw new NotFoundError('Holiday');
      await stores.settings.removeHoliday(holidayId);
      await stores.records.appendAudit({
        actorUserId: context.actor.userId,
        action: 'holiday.removed',
        entityType: 'holiday',
        entityId: holidayId,
        before: { date: holiday.date, name: holiday.name },
        requestId: context.requestId,
      });
    });
  }
}
