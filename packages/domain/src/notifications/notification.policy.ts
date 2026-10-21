import {
  NOTIFICATION_URGENCY,
  type NotificationChannel,
  type NotificationKind,
  SENSITIVE_NOTIFICATION_KINDS,
} from './notification-kinds';

export interface QuietHours {
  /** "22:00" — local wall-clock time in the business timezone. */
  readonly start: string;
  readonly end: string;
}

export interface ChannelPreference {
  readonly kind: NotificationKind;
  readonly channel: NotificationChannel;
  readonly enabled: boolean;
}

/** What the email channel needs to know about the studio and the person. */
export interface EmailChannelInput {
  /** Email notifications are switched on for the studio and a sender is configured. */
  readonly configured: boolean;
  readonly hasAddress: boolean;
  /** The person collects non-urgent emails into one email a day. */
  readonly dailyDigest: boolean;
}

export interface DeliveryPlanInput {
  readonly kind: NotificationKind;
  readonly preferences: readonly ChannelPreference[];
  readonly hasActiveDevice: boolean;
  readonly smsConfigured: boolean;
  /** Absent when the caller does not plan email at all (treated as not configured). */
  readonly email?: EmailChannelInput;
  readonly quietHours: QuietHours | null;
  /** Local "HH:mm" in the business timezone at the moment of sending. */
  readonly localTime: string;
}

export interface ChannelDecision {
  readonly channel: NotificationChannel;
  /** `digest`: held for the person's daily email digest. */
  readonly deliver: 'now' | 'after_quiet_hours' | 'digest' | 'skip';
  readonly reason: string;
}

function minutesOf(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

export function isWithinQuietHours(quiet: QuietHours, localTime: string): boolean {
  const now = minutesOf(localTime);
  const start = minutesOf(quiet.start);
  const end = minutesOf(quiet.end);
  return start <= end ? now >= start && now < end : now >= start || now < end;
}

function preferenceFor(input: DeliveryPlanInput, channel: NotificationChannel): boolean | null {
  const match = input.preferences.find(
    (pref) => pref.kind === input.kind && pref.channel === channel,
  );
  return match ? match.enabled : null;
}

function planPush(input: DeliveryPlanInput, urgent: boolean): ChannelDecision {
  const pushPreference = preferenceFor(input, 'push') ?? true;
  if (!input.hasActiveDevice) {
    return { channel: 'push', deliver: 'skip', reason: 'No registered device.' };
  }
  if (!pushPreference) {
    return { channel: 'push', deliver: 'skip', reason: 'Turned off by the person.' };
  }
  if (input.quietHours && !urgent && isWithinQuietHours(input.quietHours, input.localTime)) {
    return { channel: 'push', deliver: 'after_quiet_hours', reason: 'Held until quiet hours end.' };
  }
  return { channel: 'push', deliver: 'now', reason: 'Push enabled.' };
}

/**
 * Email is opt-in per kind. Quiet hours do not apply (nothing buzzes until
 * the person opens their mail); a daily digest collects everything that is
 * not urgent.
 */
function planEmail(input: DeliveryPlanInput, urgent: boolean): ChannelDecision | null {
  const email = input.email;
  if (!email?.configured || preferenceFor(input, 'email') !== true) return null;
  if (!email.hasAddress) {
    return { channel: 'email', deliver: 'skip', reason: 'No email address on file.' };
  }
  if (email.dailyDigest && !urgent) {
    return { channel: 'email', deliver: 'digest', reason: 'Collected for the daily digest.' };
  }
  return { channel: 'email', deliver: 'now', reason: 'Email opted in.' };
}

/**
 * Decides which channels deliver a notification. In-app always records it;
 * push respects preferences and quiet hours (urgent items bypass quiet
 * hours); SMS is reserved for urgent items when the person opted in and SMS
 * is switched on; email is opt-in per kind, immediate or in a daily digest.
 */
export function planNotificationDelivery(input: DeliveryPlanInput): ChannelDecision[] {
  const urgent = NOTIFICATION_URGENCY[input.kind] === 'urgent';
  const decisions: ChannelDecision[] = [
    { channel: 'in_app', deliver: 'now', reason: 'Always kept in the inbox.' },
    planPush(input, urgent),
  ];
  const smsWanted = preferenceFor(input, 'sms') === true && urgent;
  if (smsWanted && input.smsConfigured) {
    decisions.push({ channel: 'sms', deliver: 'now', reason: 'Urgent and SMS opted in.' });
  }
  const email = planEmail(input, urgent);
  if (email) decisions.push(email);
  return decisions;
}

/** One notification per person, kind and subject within a window, so retries never spam. */
export function notificationDedupeKey(input: {
  readonly kind: NotificationKind;
  readonly recipientId: string;
  readonly subjectId: string;
  readonly window?: string;
}): string {
  return [input.kind, input.recipientId, input.subjectId, input.window ?? 'once'].join(':');
}

/**
 * What may leave Lintel for a lock screen or a mailbox: sensitive kinds get a
 * generic sentence, the full text stays in the app. Push, email and the daily
 * digest all use this rule.
 */
export function messagePreviewFor(
  kind: NotificationKind,
  title: string,
  body: string,
): { title: string; body: string } {
  if (!SENSITIVE_NOTIFICATION_KINDS.has(kind)) return { title, body };
  return { title: 'Lintel', body: 'You have a private update. Open the app to see it.' };
}

export function pushPreviewFor(
  kind: NotificationKind,
  title: string,
  body: string,
): { title: string; body: string } {
  return messagePreviewFor(kind, title, body);
}
