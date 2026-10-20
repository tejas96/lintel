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

export interface DeliveryPlanInput {
  readonly kind: NotificationKind;
  readonly preferences: readonly ChannelPreference[];
  readonly hasActiveDevice: boolean;
  readonly smsConfigured: boolean;
  readonly quietHours: QuietHours | null;
  /** Local "HH:mm" in the business timezone at the moment of sending. */
  readonly localTime: string;
}

export interface ChannelDecision {
  readonly channel: NotificationChannel;
  readonly deliver: 'now' | 'after_quiet_hours' | 'skip';
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

/**
 * Decides which channels deliver a notification. In-app always records it;
 * push respects preferences and quiet hours (urgent items bypass quiet
 * hours); SMS is reserved for urgent items when the person opted in.
 */
export function planNotificationDelivery(input: DeliveryPlanInput): ChannelDecision[] {
  const urgency = NOTIFICATION_URGENCY[input.kind];
  const decisions: ChannelDecision[] = [
    { channel: 'in_app', deliver: 'now', reason: 'Always kept in the inbox.' },
  ];
  const pushPreference = preferenceFor(input, 'push') ?? true;
  if (!input.hasActiveDevice) {
    decisions.push({ channel: 'push', deliver: 'skip', reason: 'No registered device.' });
  } else if (!pushPreference) {
    decisions.push({ channel: 'push', deliver: 'skip', reason: 'Turned off by the person.' });
  } else if (
    input.quietHours &&
    urgency !== 'urgent' &&
    isWithinQuietHours(input.quietHours, input.localTime)
  ) {
    decisions.push({
      channel: 'push',
      deliver: 'after_quiet_hours',
      reason: 'Held until quiet hours end.',
    });
  } else {
    decisions.push({ channel: 'push', deliver: 'now', reason: 'Push enabled.' });
  }
  const smsWanted = preferenceFor(input, 'sms') === true && urgency === 'urgent';
  if (smsWanted && input.smsConfigured) {
    decisions.push({ channel: 'sms', deliver: 'now', reason: 'Urgent and SMS opted in.' });
  }
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

export function pushPreviewFor(
  kind: NotificationKind,
  title: string,
  body: string,
): { title: string; body: string } {
  if (!SENSITIVE_NOTIFICATION_KINDS.has(kind)) return { title, body };
  return { title: 'Lintel', body: 'You have a private update. Open the app to see it.' };
}
