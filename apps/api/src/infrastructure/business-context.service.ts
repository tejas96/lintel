import type {
  ApplicationStores,
  FeatureFlags,
  NotifierDefaults,
  OrganizationSettings,
  UnitOfWork,
} from '@lintel/application';
import { Notifier } from '@lintel/application';
import { type CalendarDate, type Clock, calendarDateInTimeZone } from '@lintel/shared';
import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, FEATURE_FLAGS, UNIT_OF_WORK } from './tokens';

const CACHE_MS = 30_000;

/**
 * Studio-wide context every module needs: today's date in the business
 * timezone, settings, and a Notifier bound to a transaction's stores.
 */
@Injectable()
export class BusinessContextService {
  private cached: { settings: OrganizationSettings; at: number } | null = null;

  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork<ApplicationStores>,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(FEATURE_FLAGS) private readonly flags: FeatureFlags,
  ) {}

  async settings(): Promise<OrganizationSettings> {
    const now = Date.now();
    if (this.cached && now - this.cached.at < CACHE_MS) return this.cached.settings;
    const settings = await this.uow.stores.settings.organization();
    this.cached = { settings, at: now };
    return settings;
  }

  /** Clears the cache after settings change. */
  invalidate(): void {
    this.cached = null;
  }

  async today(): Promise<CalendarDate> {
    const settings = await this.settings();
    return calendarDateInTimeZone(this.clock.now(), settings.timeZone);
  }

  async notifierDefaults(): Promise<NotifierDefaults> {
    const settings = await this.settings();
    return {
      timeZone: settings.timeZone,
      quietHoursStart: settings.defaultQuietHoursStart,
      quietHoursEnd: settings.defaultQuietHoursEnd,
      smsConfigured: this.flags.smsNotificationsEnabled,
    };
  }

  /** A Notifier that writes through the given (usually transactional) stores. */
  async notifierFor(stores: ApplicationStores): Promise<Notifier> {
    return new Notifier(
      stores.notifications,
      stores.records,
      this.clock,
      await this.notifierDefaults(),
    );
  }
}
