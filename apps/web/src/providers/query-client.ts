import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { isApiError } from '@/lib/api/api-error';

/** Sends the browser to sign-in, keeping the current page as the return path. */
export function redirectToSignIn(): void {
  const here = `${window.location.pathname}${window.location.search}`;
  const target = here.startsWith('/sign-in')
    ? '/sign-in'
    : `/sign-in?next=${encodeURIComponent(here)}&expired=1`;
  window.location.assign(target);
}

function handleUnauthenticated(error: unknown): void {
  if (isApiError(error) && error.isUnauthenticated) redirectToSignIn();
}

/** Sign-in calls answer 401 for a wrong code; those must not bounce to sign-in. */
export const SKIP_AUTH_REDIRECT = { skipAuthRedirect: true } as const;

/**
 * Data stays fresh for 30 s and refreshes when the window regains focus.
 * Only network failures and 5xx answers are retried; 4xx answers are final.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({ onError: handleUnauthenticated }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (mutation.meta?.skipAuthRedirect === true) return;
        handleUnauthenticated(error);
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        retry: (failureCount, error) =>
          failureCount < 2 && isApiError(error) && (error.status === 0 || error.status >= 500),
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 6000),
      },
      mutations: { retry: false },
    },
  });
}
