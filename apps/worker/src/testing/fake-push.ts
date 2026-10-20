import type {
  PushAttemptProgress,
  PushDeliveryFacts,
  PushDeliveryOutcome,
  PushDeliveryStore,
  PushDevice,
  PushMessage,
  PushProvider,
  PushResult,
} from '@lintel/application';

type Delivery = NonNullable<PushDeliveryFacts['delivery']>;

/** In-memory push deliveries and device tokens. */
export class FakePushDeliveryStore implements PushDeliveryStore {
  readonly facts = new Map<string, PushDeliveryFacts>();
  readonly devices = new Map<string, PushDevice[]>();
  readonly revoked: { deviceId: string; reason: string }[] = [];

  delivery(notificationId: string): Delivery | null {
    return this.facts.get(notificationId)?.delivery ?? null;
  }

  async pushDelivery(notificationId: string) {
    return this.facts.get(notificationId) ?? null;
  }

  async activeDevices(userId: string) {
    const revoked = new Set(this.revoked.map((entry) => entry.deviceId));
    return (this.devices.get(userId) ?? []).filter((device) => !revoked.has(device.id));
  }

  async revokeDevice(deviceId: string, reason: string) {
    this.revoked.push({ deviceId, reason });
  }

  private update(deliveryId: string, change: (delivery: Delivery) => Delivery | null): boolean {
    for (const [id, facts] of this.facts) {
      if (facts.delivery?.id !== deliveryId) continue;
      const next = change(facts.delivery);
      if (!next) return false;
      this.facts.set(id, { ...facts, delivery: next });
      return true;
    }
    return false;
  }

  lastError = new Map<string, string | null>();

  async recordAttempt(deliveryId: string, progress: PushAttemptProgress) {
    this.lastError.set(deliveryId, progress.lastError);
    this.update(deliveryId, (delivery) => ({
      ...delivery,
      attempts: progress.attempts,
      providerMessageId: progress.providerMessageId,
    }));
  }

  async finish(deliveryId: string, outcome: PushDeliveryOutcome) {
    this.lastError.set(deliveryId, outcome.lastError);
    return this.update(deliveryId, (delivery) =>
      delivery.status === 'pending' || delivery.status === 'deferred'
        ? {
            ...delivery,
            status: outcome.status,
            attempts: outcome.attempts,
            providerMessageId: outcome.providerMessageId,
          }
        : null,
    );
  }
}

/** A push provider whose answer per token is scripted (default: sent). */
export class ScriptedPushProvider implements PushProvider {
  readonly name = 'scripted';
  readonly isDevelopmentOnly = true;
  readonly sent: PushMessage[] = [];
  readonly script = new Map<string, PushResult[]>();

  async send(message: PushMessage): Promise<PushResult> {
    this.sent.push(message);
    const queue = this.script.get(message.token);
    const scripted = queue?.shift();
    return scripted ?? { outcome: 'sent', providerMessageId: `msg-${message.token}` };
  }
}
