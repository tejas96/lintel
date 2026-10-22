import { type Guidance, guidanceSchema } from '@lintel/api-contracts';
import { cookies } from 'next/headers';
import { SESSION_COOKIE } from './contract';
import { API_INTERNAL_URL } from './server-session';

/**
 * Server-side only: the person's first-run tips, fetched with the page so a
 * tip renders in place on first paint instead of pushing the page down when
 * it arrives later. A tip is a nicety: any failure is simply null.
 */
export async function lookUpGuidance(): Promise<Guidance | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const response = await fetch(`${API_INTERNAL_URL}/v1/me/guidance`, {
      headers: {
        cookie: `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
        accept: 'application/json',
      },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const parsed = guidanceSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
