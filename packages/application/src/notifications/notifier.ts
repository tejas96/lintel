import { domainEvent, planNotificationDelivery } from '@lintel/domain';
import { addDays, type Clock, calendarDateInTimeZone, zonedTimeToInstant } from '@lintel/shared';
import type { RecordStore } from '../common/record.store';
import type { NewNotification, NotificationStore, PlannedDelivery } from './notification.store';

export interface NotifierDefaults {
  readonly timeZone: string;
  readonly quietHoursStart: string;
  readonly quietHoursEnd: string;
  readonly smsConfigured: boolean;
}

function localTime(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(now);
}

/**
 * Creates in-app notifications and plans push/SMS deliveries using the
 * notification policy. Call it inside the same transaction as the change;
 * an outbox event lets the worker deliver push messages with retries.
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
      quietHours,
      localTime: localTime(now, this.defaults.timeZone),
    });
    const deliveries: PlannedDelivery[] = decisions
      .filter((decision) => decision.channel !== 'in_app')
      .map((decision) => ({
        channel: decision.channel,
        status:
          decision.deliver === 'now'
            ? 'pending'
            : decision.deliver === 'skip'
              ? 'skipped'
              : 'deferred',
        notBefore:
          decision.deliver === 'after_quiet_hours' ? this.quietHoursEnd(now, quietHours.end) : null,
        reason: decision.reason,
      }));
    const created = await this.store.create(notification, deliveries);
    if (created && deliveries.some((delivery) => delivery.status !== 'skipped')) {
      await this.records.enqueueEvent(
        domainEvent('NotificationCreated', 'notification', created.id, {
          notificationId: created.id,
          recipientId: notification.recipientUserId,
        }),
      );
    }
  }

  async notifyMany(notifications: readonly NewNotification[]): Promise<void> {
    for (const notification of notifications) await this.notify(notification);
  }

  private quietHoursEnd(now: Date, end: string): Date {
    const today = calendarDateInTimeZone(now, this.defaults.timeZone);
    const todayEnd = zonedTimeToInstant(today, end, this.defaults.timeZone);
    return todayEnd > now
      ? todayEnd
      : zonedTimeToInstant(addDays(today, 1), end, this.defaults.timeZone);
  }
}
