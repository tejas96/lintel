import type { NotifierDefaults, OrganizationSettings, SettingsStore } from '@lintel/application';
import { type CalendarDate, type Clock, calendarDateInTimeZone } from '@lintel/shared';

const CACHE_MS = 30_000;

export interface OrganizationContextOptions {
  readonly smsConfigured: boolean;
}

/**
 * Studio-wide settings for activities, cached briefly so that frequent
 * reminders do not re-read them. Mirrors the API's BusinessContextService.
 */
export class OrganizationContext {
  private cached: { settings: OrganizationSettings; at: number } | null = null;

  constructor(
    private readonly settingsStore: Pick<SettingsStore, 'organization'>,
    private readonly clock: Clock,
    private readonly options: OrganizationContextOptions,
  ) {}

  async settings(): Promise<OrganizationSettings> {
    const now = this.clock.now().getTime();
    if (this.cached && now - this.cached.at < CACHE_MS) return this.cached.settings;
    const settings = await this.settingsStore.organization();
    this.cached = { settings, at: now };
    return settings;
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
      smsConfigured: this.options.smsConfigured,
    };
  }
}
