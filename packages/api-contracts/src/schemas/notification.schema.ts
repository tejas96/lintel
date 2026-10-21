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

const preferenceRows = z.array(
  z.object({
    kind: notificationKindSchema,
    channel: notificationChannelSchema,
    enabled: z.boolean(),
  }),
);

/** `daily`: non-urgent emails wait for one digest a day. */
export const emailDigestSchema = z.enum(['off', 'daily']);

export const notificationPreferencesObject = z.object({
  quietHours: z.object({ start: z.string(), end: z.string() }).nullable(),
  channels: preferenceRows,
  emailDigest: emailDigestSchema,
  /** What the studio has switched on, so apps only offer channels that can deliver. */
  delivery: z.object({
    sms: z.boolean(),
    email: z.boolean(),
    /** Whether an email address is on file for the person (never the address itself). */
    hasEmailAddress: z.boolean(),
  }),
});
export type NotificationPreferences = z.infer<typeof notificationPreferencesObject>;
export const notificationPreferencesSchema: ResponseSchema<NotificationPreferences> =
  notificationPreferencesObject;

/** What a person can change. `emailDigest` is optional so older apps keep working. */
export const notificationPreferencesInputSchema = z.object({
  quietHours: z.object({ start: z.string(), end: z.string() }).nullable(),
  channels: preferenceRows,
  emailDigest: emailDigestSchema.optional(),
});
export type NotificationPreferencesInput = z.infer<typeof notificationPreferencesInputSchema>;

/**
 * `fcm`: Android registration token; `fcm_fid`: web Firebase Installation ID
 * (from `register()`/`onRegistered()`); `apns`: raw iOS token (not sent).
 */
export const pushTokenTypeSchema = z.enum(['fcm', 'apns', 'fcm_fid']);

export const deviceSchema = z.object({
  id: idSchema,
  platform: z.enum(['ios', 'android', 'web']),
  appVersion: z.string().nullable(),
  lastSeenAt: instantSchema,
});
