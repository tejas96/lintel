import type { Capability } from '@lintel/domain';
import { ForbiddenError } from '@lintel/shared';
import type { RequestContext } from './request-context';

/** Organisation-wide actions need an explicit capability; answers 403 otherwise. */
export function requireCapability(context: RequestContext, capability: Capability): void {
  if (!context.actor.capabilities.has(capability)) throw new ForbiddenError();
}
