import { type ChannelDecision, domainEvent, planNotificationDelivery } from '@lintel/domain';
import { addDays, type Clock, calendarDateInTimeZone, zonedTimeToInstant } from '@lintel/shared';
import type { RecordStore } from '../common/record.store';
import type { NewNotification, NotificationStore, PlannedDelivery } from './notification.store';

export interface NotifierDefaults {
  readonly timeZone: string;
  readonly quietHoursStart: string;
  readonly quietHoursEnd: string;
  readonly smsConfigured: boolean;
  /** EMAIL_NOTIFICATIONS_ENABLED; email is never planned when absent or false. */
  readonly emailConfigured?: boolean;
}

function localTime(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(now);
}

const STATUS_FOR: Readonly<Record<ChannelDecision['deliver'], PlannedDelivery['status']>> = {
  now: 'pending',
  after_quiet_hours: 'deferred',
  digest: 'digest',
  skip: 'skipped',
};

const OPEN: ReadonlySet<PlannedDelivery['status']> = new Set(['pending', 'deferred']);

/**
 * Creates in-app notifications and plans push/SMS/email deliveries using the
 * notification policy. Call it inside the same transaction as the change;
 * outbox events let the worker deliver push, SMS and email with retries.
 */
export class Notifier {
  constructor(
    private readonly store: NotificationStore,
    private readonly records: RecordStore,
    private readonly clock: Clock,
    private readonly defaults: NotifierDefaults,
  ) {}

  async notify(notification: NewNotification): Promise<void> {
    const context = await this.store.recipientContext(notification.recipientUserId);
    if (!context) return;
    const now = this.clock.now();
    const quietHours = {
      start: context.quietHoursStart ?? this.defaults.quietHoursStart,
      end: context.quietHoursEnd ?? this.defaults.quietHoursEnd,
    };
    const decisions = planNotificationDelivery({
      kind: notification.kind,
      preferences: context.preferences,
      hasActiveDevice: context.hasActiveDevice,
      smsConfigured: this.defaults.smsConfigured,
      email: {
        configured: this.defaults.emailConfigured ?? false,
        hasAddress: context.email?.hasAddress ?? false,
        dailyDigest: context.email?.dailyDigest ?? false,
      },
      quietHours,
      localTime: localTime(now, this.defaults.timeZone),
    });
    const deliveries: PlannedDelivery[] = decisions
      .filter((decision) => decision.channel !== 'in_app')
      .map((decision) => ({
        channel: decision.channel,
        status: STATUS_FOR[decision.deliver],
        notBefore:
          decision.deliver === 'after_quiet_hours' ? this.quietHoursEnd(now, quietHours.end) : null,
        reason: decision.reason,
      }));
    const created = await this.store.create(notification, deliveries);
    if (created) await this.enqueueDeliveries(created.id, notification, deliveries);
  }

  async notifyMany(notifications: readonly NewNotification[]): Promise<void> {
    for (const notification of notifications) await this.notify(notification);
  }

  /** One event for push (as before) and one per SMS or immediate email. */
  private async enqueueDeliveries(
    notificationId: string,
    notification: NewNotification,
    deliveries: readonly PlannedDelivery[],
  ): Promise<void> {
    const recipientId = notification.recipientUserId;
    const open = deliveries.filter((delivery) => OPEN.has(delivery.status));
    if (open.some((delivery) => delivery.channel === 'push')) {
      await this.records.enqueueEvent(
        domainEvent('NotificationCreated', 'notification', notificationId, {
          notificationId,
          recipientId,
        }),
      );
    }
    for (const delivery of open) {
      if (delivery.channel !== 'sms' && delivery.channel !== 'email') continue;
      await this.records.enqueueEvent(
        domainEvent('NotificationMessageQueued', 'notification', notificationId, {
          notificationId,
          recipientId,
          channel: delivery.channel,
        }),
      );
    }
  }

  private quietHoursEnd(now: Date, end: string): Date {
    const today = calendarDateInTimeZone(now, this.defaults.timeZone);
    const todayEnd = zonedTimeToInstant(today, end, this.defaults.timeZone);
    return todayEnd > now
      ? todayEnd
      : zonedTimeToInstant(addDays(today, 1), end, this.defaults.timeZone);
  }
}
