'use client';

import type { CurrentUser } from '@lintel/api-contracts';
import type { Capability } from '@lintel/domain';
import { useQuery } from '@tanstack/react-query';
import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { api, expectStatus } from '@/lib/api/api-client';

interface Session {
  readonly user: CurrentUser;
  /** True when the person holds any of the given capabilities. */
  readonly can: (...capabilities: Capability[]) => boolean;
}

const SessionContext = createContext<Session | null>(null);

export const sessionQueryKey = ['session', 'me'] as const;

/**
 * The signed-in person, rendered by the server and kept fresh on the client
 * (capabilities can change while the app is open).
 */
export function SessionProvider({
  user,
  children,
}: {
  readonly user: CurrentUser;
  readonly children: ReactNode;
}) {
  const { data } = useQuery({
    queryKey: sessionQueryKey,
    queryFn: () => expectStatus(api.auth.me(), 200),
    initialData: user,
    staleTime: 5 * 60_000,
  });
  const value = useMemo<Session>(() => {
    const held = new Set<Capability>(data.capabilities);
    return {
      user: data,
      can: (...capabilities) => capabilities.some((capability) => held.has(capability)),
    };
  }, [data]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession must be used inside SessionProvider.');
  return session;
}
