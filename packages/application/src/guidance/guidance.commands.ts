import {
  GUIDANCE_TIP_KEYS,
  type GuidanceAudience,
  type GuidanceTipKey,
  guidanceAudienceFor,
  guidanceTipFor,
} from '@lintel/domain';
import type { Clock } from '@lintel/shared';
import type { RequestContext } from '../common/request-context';
import type { ApplicationStores, UnitOfWork } from '../common/unit-of-work';

export interface GuidanceTipView {
  readonly key: GuidanceTipKey;
  readonly title: string;
  readonly body: string;
  readonly seen: boolean;
}

export interface GuidanceView {
  readonly audience: GuidanceAudience;
  readonly tips: GuidanceTipView[];
}

/**
 * First-run tips: a short, role-specific tip the first time someone opens
 * Today, a task, the control room, leave or the command center. Seen tips are
 * stored per person on the server, so each shows once across devices. Tips
 * never block work; anyone may ask to see them again.
 */
export class GuidanceCommands {
  constructor(
    private readonly uow: UnitOfWork<Pick<ApplicationStores, 'guidance'>>,
    private readonly clock: Clock,
  ) {}

  async list(context: RequestContext): Promise<GuidanceView> {
    const audience = guidanceAudienceFor(context.actor.capabilities);
    const seen = new Set(await this.uow.stores.guidance.seenTipKeys(context.actor.userId));
    const tips = GUIDANCE_TIP_KEYS.flatMap((key): GuidanceTipView[] => {
      const tip = guidanceTipFor(key, audience);
      return tip ? [{ ...tip, seen: seen.has(key) }] : [];
    });
    return { audience, tips };
  }

  async markSeen(context: RequestContext, key: GuidanceTipKey): Promise<GuidanceView> {
    await this.uow.stores.guidance.markSeen(context.actor.userId, key, this.clock.now());
    return this.list(context);
  }

  async showAgain(context: RequestContext): Promise<GuidanceView> {
    await this.uow.stores.guidance.forget(context.actor.userId);
    return this.list(context);
  }
}
