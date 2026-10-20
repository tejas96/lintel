import type { CurrentUser } from '@lintel/api-contracts';
import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api, unwrap } from '@/api/api-client';
import { ApiError } from '@/api/api-error';
import { queryClient } from '@/api/query-client';
import { queryKeys } from '@/api/query-keys';
import { onSessionExpired, setSessionToken } from '@/api/session-token';
import { forgetPushDevice, unregisterPushDevice } from '@/push/push-device';
import { deleteSecure, readSecure, STORAGE_KEYS, writeSecure } from './secure-storage';

export type SessionState =
  | { readonly status: 'restoring' }
  | { readonly status: 'unreachable' }
  | { readonly status: 'signedOut'; readonly notice: string | null }
  | { readonly status: 'signedIn'; readonly user: CurrentUser };

interface SessionContextValue {
  readonly state: SessionState;
  /** The last signed-in person, kept while signed-in screens unmount after sign-out. */
  readonly lastUser: CurrentUser | null;
  completeSignIn(token: string, user: CurrentUser): Promise<void>;
  /** Re-reads the person (capabilities can change while the app is open). */
  refreshUser(): Promise<void>;
  signOut(): Promise<void>;
  /** Re-checks a saved session; resolves when the answer (or failure) is in. */
  retryRestore(): Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

const EXPIRED_NOTICE = 'Your session has ended. Please sign in again.';

async function clearLocalSession(): Promise<void> {
  setSessionToken(null);
  await deleteSecure(STORAGE_KEYS.sessionToken);
  queryClient.clear();
}

/**
 * Owns the signed-in person. The bearer token is read from the secure store at
 * launch, checked with GET /auth/me, and cleared on sign-out or expiry.
 */
export function SessionProvider({ children }: { readonly children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'restoring' });
  const [lastUser, setLastUser] = useState<CurrentUser | null>(null);
  useEffect(() => {
    if (state.status === 'signedIn') setLastUser(state.user);
  }, [state]);

  const restore = useCallback(async () => {
    const token = await readSecure(STORAGE_KEYS.sessionToken);
    if (!token) {
      setState({ status: 'signedOut', notice: null });
      return;
    }
    setSessionToken(token);
    try {
      const user = await unwrap(api.auth.me());
      queryClient.setQueryData(queryKeys.me, user);
      setState({ status: 'signedIn', user });
    } catch (error) {
      // A 401 is handled by the expiry listener; anything else keeps the token for a retry.
      if (!(error instanceof ApiError && error.status === 401)) setState({ status: 'unreachable' });
    }
  }, []);

  useEffect(() => {
    void restore();
  }, [restore]);

  useEffect(
    () =>
      onSessionExpired(() => {
        void forgetPushDevice();
        void clearLocalSession().then(() =>
          setState({ status: 'signedOut', notice: EXPIRED_NOTICE }),
        );
      }),
    [],
  );

  const completeSignIn = useCallback(async (token: string, user: CurrentUser) => {
    await writeSecure(STORAGE_KEYS.sessionToken, token);
    setSessionToken(token);
    queryClient.setQueryData(queryKeys.me, user);
    setState({ status: 'signedIn', user });
  }, []);

  const refreshUser = useCallback(async () => {
    const user = await unwrap(api.auth.me());
    queryClient.setQueryData(queryKeys.me, user);
    setState((current) => (current.status === 'signedIn' ? { status: 'signedIn', user } : current));
  }, []);

  const signOut = useCallback(async () => {
    await unregisterPushDevice();
    try {
      await unwrap(api.auth.signOut({ body: {} }));
    } catch {
      // Signing out locally is what matters; the server session expires anyway.
    }
    await clearLocalSession();
    setState({ status: 'signedOut', notice: null });
  }, []);

  const retryRestore = useCallback(() => restore(), [restore]);

  const value = useMemo(
    () => ({ state, lastUser, completeSignIn, refreshUser, signOut, retryRestore }),
    [state, lastUser, completeSignIn, refreshUser, signOut, retryRestore],
  );
  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): SessionContextValue {
  const context = use(SessionContext);
  if (!context) throw new Error('useSession must be used inside <SessionProvider>.');
  return context;
}

/**
 * The signed-in person; only call inside the signed-in part of the app. While
 * those screens unmount after sign-out or expiry, the last person is returned.
 */
export function useCurrentUser(): CurrentUser {
  const { state, lastUser } = useSession();
  if (state.status === 'signedIn') return state.user;
  if (lastUser) return lastUser;
  throw new Error('useCurrentUser needs a signed-in session.');
}
