import type { AuthenticatedSession, RequestContext } from '@lintel/application';
import { UnauthenticatedError } from '@lintel/shared';
import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';

export const PUBLIC_ROUTE = 'lintel:public-route';

/** Marks a handler as reachable without a session (sign-in and health checks only). */
export const Public = () => SetMetadata(PUBLIC_ROUTE, true);

function authOf(context: ExecutionContext): AuthenticatedSession & { requestId: string } {
  const request = context.switchToHttp().getRequest<Request>();
  if (!request.auth) throw new UnauthenticatedError();
  return { ...request.auth, requestId: request.requestId ?? 'unknown' };
}

/** The verified actor for this request, as an application RequestContext. */
export const Ctx = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RequestContext => {
    const auth = authOf(context);
    return { actor: auth.actor, sessionId: auth.session.id, requestId: auth.requestId };
  },
);

/** The full authenticated session (user record included). */
export const CurrentSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedSession => authOf(context),
);
