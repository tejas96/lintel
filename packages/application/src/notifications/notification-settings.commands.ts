import type { NotificationChannel } from '@lintel/domain';
import { type Clock, NotFoundError, ValidationFailedError } from '@lintel/shared';
import type { RequestContext } from '../common/request-context';
import type { ApplicationStores, UnitOfWork } from '../common/unit-of-work';
import type {
  ChannelPreferenceRecord,
  DeviceRecord,
  DeviceRegistration,
} from './notification-inbox.store';

/**
 * What a channel does when the person never chose: the in-app inbox always
 * keeps everything, push is on, SMS and email are opt-in. Mirrors the
 * delivery policy, which treats a missing push preference as enabled.
 */
export function defaultChannelPreference(channel: NotificationChannel): boolean {
  return channel === 'in_app' || channel === 'push';
}

const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface PreferencesInput {
  readonly quietHours: { start: string; end: string } | null;
  readonly channels: readonly ChannelPreferenceRecord[];
}

type InboxStores = Pick<ApplicationStores, 'inbox' | 'records'>;

/** Inbox state, preferences and push devices. Every call acts on the signed-in person only. */
export class NotificationSettingsCommands {
  constructor(
    private readonly uow: UnitOfWork<InboxStores>,
    private readonly clock: Clock,
  ) {}

  async markRead(context: RequestContext, notificationId: string): Promise<void> {
    const marked = await this.uow.stores.inbox.markRead(
      context.actor.userId,
      notificationId,
      this.clock.now(),
    );
    if (!marked) throw new NotFoundError('Notification');
  }

  async markAllRead(context: RequestContext): Promise<void> {
    await this.uow.stores.inbox.markAllRead(context.actor.userId, this.clock.now());
  }

  async updatePreferences(context: RequestContext, input: PreferencesInput): Promise<void> {
    const quiet = input.quietHours;
    if (quiet && (!TIME_OF_DAY.test(quiet.start) || !TIME_OF_DAY.test(quiet.end))) {
      throw new ValidationFailedError('Quiet hours use 24-hour HH:mm times.', [
        { field: 'quietHours', message: 'Use times like 21:30.' },
      ]);
    }
    if (quiet && quiet.start === quiet.end) {
      throw new ValidationFailedError('Quiet hours need different start and end times.', [
        { field: 'quietHours', message: 'Start and end cannot be the same.' },
      ]);
    }
    if (input.channels.some((row) => row.channel === 'in_app' && !row.enabled)) {
      throw new ValidationFailedError('The in-app inbox always keeps every notification.', [
        { field: 'channels', message: 'In-app notifications cannot be turned off.' },
      ]);
    }
    await this.uow.transaction(async (stores) => {
      const userId = context.actor.userId;
      await stores.inbox.savePreferences(userId, input.channels);
      await stores.inbox.setQuietHours(userId, quiet?.start ?? null, quiet?.end ?? null);
      await stores.records.appendAudit({
        actorUserId: userId,
        action: 'notifications.preferences_updated',
        entityType: 'user',
        entityId: userId,
        after: { quietHours: quiet, changedRows: input.channels.length },
        requestId: context.requestId,
      });
    });
  }

  async registerDevice(context: RequestContext, input: DeviceRegistration): Promise<DeviceRecord> {
    return this.uow.transaction(async (stores) => {
      const { device, previousUserId } = await stores.inbox.registerDevice(
        context.actor.userId,
        input,
        this.clock.now(),
      );
      if (previousUserId && previousUserId !== context.actor.userId) {
        await stores.records.appendAudit({
          actorUserId: context.actor.userId,
          action: 'device.reassigned',
          entityType: 'device_token',
          entityId: device.id,
          before: { userId: previousUserId },
          after: { userId: context.actor.userId, platform: device.platform },
          requestId: context.requestId,
        });
      }
      return device;
    });
  }

  async unregisterDevice(context: RequestContext, deviceId: string): Promise<void> {
    const revoked = await this.uow.stores.inbox.revokeDevice(
      context.actor.userId,
      deviceId,
      this.clock.now(),
      'unregistered',
    );
    if (!revoked) throw new NotFoundError('Device');
  }
}
