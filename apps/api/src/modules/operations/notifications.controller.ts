import {
  type FeatureFlags,
  NotificationSettingsCommands,
  type RequestContext,
} from '@lintel/application';
import type { Environment } from '@lintel/configuration';
import {
  type DatabaseConnection,
  loadNotificationPreferences,
  managesOpenProjects,
  queryNotifications,
} from '@lintel/database';
import { receivableNotificationKinds } from '@lintel/domain';
import { Controller, Inject } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { Ctx } from '../../common/auth/auth.decorators';
import { pageOf } from '../../common/http/access';
import { ENVIRONMENT } from '../../config/configuration.module';
import { apiContract } from '../../contract';
import { DATABASE_CONNECTION, FEATURE_FLAGS } from '../../infrastructure/tokens';

const operations = apiContract.operations;
const routes = {
  listNotifications: operations.listNotifications,
  markNotificationRead: operations.markNotificationRead,
  markAllNotificationsRead: operations.markAllNotificationsRead,
  getNotificationPreferences: operations.getNotificationPreferences,
  updateNotificationPreferences: operations.updateNotificationPreferences,
  registerDevice: operations.registerDevice,
  unregisterDevice: operations.unregisterDevice,
};

/** The signed-in person's inbox, notification preferences and push devices. */
@Controller()
export class NotificationsController {
  constructor(
    private readonly commands: NotificationSettingsCommands,
    @Inject(DATABASE_CONNECTION) private readonly database: DatabaseConnection,
    @Inject(FEATURE_FLAGS) private readonly flags: FeatureFlags,
    @Inject(ENVIRONMENT) private readonly env: Environment,
  ) {}

  /** The person's choices plus what the studio has switched on (never the address itself). */
  private async preferences(context: RequestContext) {
    const { userId, capabilities } = context.actor;
    const [{ hasEmailAddress, ...choices }, managesProjects] = await Promise.all([
      loadNotificationPreferences(this.database.db, userId),
      managesOpenProjects(this.database.db, userId),
    ]);
    return {
      ...choices,
      receivableKinds: receivableNotificationKinds({ capabilities, managesProjects }),
      delivery: {
        sms: this.flags.smsNotificationsEnabled,
        email: this.flags.emailNotificationsEnabled,
        hasEmailAddress,
        emailDigestTime: this.env.EMAIL_DIGEST_TIME,
      },
    };
  }

  @TsRestHandler(routes)
  handlers(@Ctx() context: RequestContext) {
    const db = this.database.db;
    const userId = context.actor.userId;
    return tsRestHandler(routes, {
      listNotifications: async ({ query }) => {
        const result = await queryNotifications(db, userId, query);
        return {
          status: 200,
          body: {
            ...pageOf(result.items, query.page, query.pageSize, result.totalItems),
            unreadCount: result.unreadCount,
          },
        };
      },
      markNotificationRead: async ({ params }) => {
        await this.commands.markRead(context, params.id);
        return { status: 204, body: undefined };
      },
      markAllNotificationsRead: async () => {
        await this.commands.markAllRead(context);
        return { status: 204, body: undefined };
      },
      getNotificationPreferences: async () => ({
        status: 200,
        body: await this.preferences(context),
      }),
      updateNotificationPreferences: async ({ body }) => {
        await this.commands.updatePreferences(context, body);
        return { status: 200, body: await this.preferences(context) };
      },
      registerDevice: async ({ body }) => {
        const device = await this.commands.registerDevice(context, body);
        return {
          status: 200,
          body: {
            id: device.id,
            platform: device.platform,
            appVersion: device.appVersion,
            lastSeenAt: device.lastSeenAt.toISOString(),
          },
        };
      },
      unregisterDevice: async ({ params }) => {
        await this.commands.unregisterDevice(context, params.id);
        return { status: 204, body: undefined };
      },
    });
  }
}
