import { AuthenticateSessionQuery } from '@lintel/application';
import { ForbiddenError, UnauthenticatedError } from '@lintel/shared';
import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PUBLIC_ROUTE } from './auth.decorators';
import { bearerToken, cookieValue, csrfTokenMatches, SESSION_COOKIE } from './session-cookies';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Global guard. Resolves the session from a bearer token (mobile) or the
 * session cookie (web), rejects unauthenticated access to non-public routes
 * and enforces CSRF for cookie-authenticated unsafe requests.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authenticate: AuthenticateSessionQuery,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass(),
    ]);
    const bearer = bearerToken(request);
    const token = bearer ?? cookieValue(request, SESSION_COOKIE);
    if (token) {
      const auth = await this.authenticate.execute(token);
      if (auth) request.auth = { ...auth, via: bearer ? 'bearer' : 'cookie' };
    }
    if (isPublic) return true;
    if (!request.auth)
      throw new UnauthenticatedError('Your session has ended. Please sign in again.');
    if (
      request.auth.via === 'cookie' &&
      !SAFE_METHODS.has(request.method) &&
      !csrfTokenMatches(request)
    ) {
      throw new ForbiddenError('Security check failed. Refresh the page and try again.');
    }
    return true;
  }
}
