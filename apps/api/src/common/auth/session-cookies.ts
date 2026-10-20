import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';

export const SESSION_COOKIE = 'lintel_session';
export const CSRF_COOKIE = 'lintel_csrf';
export const CSRF_HEADER = 'x-lintel-csrf';

/**
 * Web sessions use an HttpOnly cookie plus a readable CSRF cookie that the
 * web app echoes in a header on every unsafe request (double-submit).
 */
export function setSessionCookies(
  response: Response,
  token: string,
  expiresAt: Date,
  secure: boolean,
): void {
  const common = { secure, sameSite: 'lax' as const, path: '/', expires: expiresAt };
  response.cookie(SESSION_COOKIE, token, { ...common, httpOnly: true });
  response.cookie(CSRF_COOKIE, randomBytes(24).toString('base64url'), {
    ...common,
    httpOnly: false,
  });
}

export function clearSessionCookies(response: Response, secure: boolean): void {
  const common = { secure, sameSite: 'lax' as const, path: '/' };
  response.clearCookie(SESSION_COOKIE, { ...common, httpOnly: true });
  response.clearCookie(CSRF_COOKIE, common);
}

export function bearerToken(request: Request): string | null {
  const header = request.header('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

export function cookieValue(request: Request, name: string): string | null {
  const cookies: unknown = request.cookies;
  if (typeof cookies !== 'object' || cookies === null) return null;
  const value = (cookies as Record<string, unknown>)[name];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function csrfTokenMatches(request: Request): boolean {
  const header = request.header(CSRF_HEADER);
  const cookie = cookieValue(request, CSRF_COOKIE);
  if (!header || !cookie) return false;
  const left = Buffer.from(header);
  const right = Buffer.from(cookie);
  return left.length === right.length && timingSafeEqual(left, right);
}
