import type {
  AttemptFinish,
  AttemptStart,
  EmailMessage,
  EmailSender,
  MessageChannel,
  MessageDeliveryFacts,
  MessageDeliveryStore,
  MessageSendResult,
  SmsMessage,
  SmsSender,
} from '@lintel/application';

type Delivery = NonNullable<MessageDeliveryFacts['delivery']>;

export interface RecordedAttempt extends AttemptStart {
  finish?: AttemptFinish;
}

/** In-memory SMS/email deliveries with per-attempt rows (same rules as the repository). */
export class FakeMessageDeliveryStore implements MessageDeliveryStore {
  readonly facts = new Map<string, MessageDeliveryFacts>();
  readonly attempts: RecordedAttempt[] = [];
  readonly lastError = new Map<string, string | null>();

  private key(notificationId: string, channel: MessageChannel) {
    return `${notificationId}:${channel}`;
  }

  add(channel: MessageChannel, facts: MessageDeliveryFacts): void {
    this.facts.set(this.key(facts.notificationId, channel), facts);
  }

  delivery(notificationId: string, channel: MessageChannel): Delivery | null {
    return this.facts.get(this.key(notificationId, channel))?.delivery ?? null;
  }

  async messageDelivery(notificationId: string, channel: MessageChannel) {
    return this.facts.get(this.key(notificationId, channel)) ?? null;
  }

  async startAttempt(start: AttemptStart) {
    const exists = this.attempts.some(
      (row) => row.deliveryId === start.deliveryId && row.attempt === start.attempt,
    );
    if (!exists) this.attempts.push({ ...start });
  }

  private update(deliveryId: string, change: (delivery: Delivery) => Delivery): boolean {
    for (const [key, facts] of this.facts) {
      const delivery = facts.delivery;
      if (delivery?.id !== deliveryId) continue;
      if (delivery.status !== 'pending' && delivery.status !== 'deferred') return false;
      this.facts.set(key, { ...facts, delivery: change(delivery) });
      return true;
    }
    return false;
  }

  async finishAttempt(finish: AttemptFinish) {
    const row = this.attempts.find(
      (entry) => entry.deliveryId === finish.deliveryId && entry.attempt === finish.attempt,
    );
    if (row) row.finish = finish;
    this.lastError.set(finish.deliveryId, finish.error);
    return this.update(finish.deliveryId, (delivery) => ({
      ...delivery,
      status: finish.deliveryStatus,
      attempts: finish.attempt,
    }));
  }

  async giveUp(deliveryId: string, reason: string) {
    this.lastError.set(deliveryId, reason);
    return this.update(deliveryId, (delivery) => ({ ...delivery, status: 'failed' }));
  }
}

class ScriptedSender<TMessage> {
  readonly sent: TMessage[] = [];
  /** Results returned in order; when empty every send succeeds. */
  readonly script: MessageSendResult[] = [];

  protected answer(message: TMessage, id: string): MessageSendResult {
    this.sent.push(message);
    return this.script.shift() ?? { outcome: 'sent', providerMessageId: id };
  }
}

export class ScriptedSmsSender extends ScriptedSender<SmsMessage> implements SmsSender {
  readonly name = 'scripted-sms';
  readonly isDevelopmentOnly = true;
  readonly templateReference = 'tpl-1 (DLT 1107000000000000001)';

  async send(message: SmsMessage) {
    return this.answer(message, `sms-${this.sent.length + 1}`);
  }
}

export class ScriptedEmailSender extends ScriptedSender<EmailMessage> implements EmailSender {
  readonly name = 'scripted-email';
  readonly isDevelopmentOnly = true;

  async send(message: EmailMessage) {
    return this.answer(message, message.messageId);
  }
}
