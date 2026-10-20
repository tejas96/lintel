import { NOTIFICATION_CHANNELS, NOTIFICATION_KINDS } from '@lintel/domain';
import { z } from 'zod';
import { idSchema, instantSchema, type ResponseSchema } from '../common/primitives';

export const notificationKindSchema = z.enum(NOTIFICATION_KINDS);
export const notificationChannelSchema = z.enum(NOTIFICATION_CHANNELS);

export const notificationObject = z.object({
  id: idSchema,
  kind: notificationKindSchema,
  title: z.string(),
  body: z.string(),
  linkPath: z.string().nullable(),
  readAt: instantSchema.nullable(),
  createdAt: instantSchema,
});
export type NotificationItem = z.infer<typeof notificationObject>;
export const notificationSchema: ResponseSchema<NotificationItem> = notificationObject;

export const notificationPreferencesObject = z.object({
  quietHours: z.object({ start: z.string(), end: z.string() }).nullable(),
  channels: z.array(
    z.object({
      kind: notificationKindSchema,
      channel: notificationChannelSchema,
      enabled: z.boolean(),
    }),
  ),
});
export type NotificationPreferences = z.infer<typeof notificationPreferencesObject>;
export const notificationPreferencesSchema: ResponseSchema<NotificationPreferences> =
  notificationPreferencesObject;

export const deviceSchema = z.object({
  id: idSchema,
  platform: z.enum(['ios', 'android', 'web']),
  appVersion: z.string().nullable(),
  lastSeenAt: instantSchema,
});
