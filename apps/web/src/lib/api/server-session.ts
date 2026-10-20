import { type CurrentUser, currentUserSchema } from '@lintel/api-contracts';
import { cookies } from 'next/headers';
import { SESSION_COOKIE } from './contract';

/** Server-side only: the API as seen from the Next server. */
export const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4105';

export type SessionLookup =
  | { readonly status: 'signed-in'; readonly user: CurrentUser }
  | { readonly status: 'signed-out' }
  | { readonly status: 'unreachable'; readonly requestId: string | null };

/**
 * Asks the API who owns the session cookie. Runs on the server for every app
 * page, so the shell renders with the person's name and permissions at once.
 */
export async function lookUpSession(): Promise<SessionLookup> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return { status: 'signed-out' };
  try {
    const response = await fetch(`${API_INTERNAL_URL}/v1/auth/me`, {
      headers: {
        cookie: `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
        accept: 'application/json',
      },
      cache: 'no-store',
    });
    if (response.status === 401) return { status: 'signed-out' };
    if (!response.ok) {
      return { status: 'unreachable', requestId: response.headers.get('x-request-id') };
    }
    const parsed = currentUserSchema.safeParse(await response.json());
    if (!parsed.success)
      return { status: 'unreachable', requestId: response.headers.get('x-request-id') };
    return { status: 'signed-in', user: parsed.data };
  } catch {
    return { status: 'unreachable', requestId: null };
  }
}

/** Only same-site relative paths are allowed as a post-sign-in destination. */
export function safeReturnPath(candidate: string | null | undefined): string {
  if (!candidate?.startsWith('/') || candidate.startsWith('//') || candidate.startsWith('/\\')) {
    return '/today';
  }
  if (candidate.startsWith('/sign-in') || candidate.startsWith('/api')) return '/today';
  return candidate;
}
