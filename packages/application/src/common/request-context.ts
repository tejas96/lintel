import type { Actor } from '@lintel/domain';

/** Who is calling and from where. Built by the API from the verified session. */
export interface RequestContext {
  readonly actor: Actor;
  readonly sessionId: string;
  readonly requestId: string;
}

/** Metadata about an unauthenticated request (sign-in). IPs are hashed before storage. */
export interface ClientContext {
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly requestId: string;
}
