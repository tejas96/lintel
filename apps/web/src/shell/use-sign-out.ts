'use client';

import { useToast } from '@lintel/design-system/web';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { removeWebDevice } from '@/features/push/use-web-push';
import { disableWebPush } from '@/features/push/web-push-client';
import { api, expectStatus } from '@/lib/api/api-client';
import { isApiError } from '@/lib/api/api-error';

/** Unregistering this browser must never hold up signing out. */
function stopWebPush(): Promise<void> {
  const timeout = new Promise<void>((resolve) => window.setTimeout(resolve, 3000));
  return Promise.race([disableWebPush(removeWebDevice).catch(() => undefined), timeout]);
}

/**
 * Stops pushes to this browser (while the session can still unregister it),
 * ends the session on the server, forgets cached data and returns to sign-in.
 */
export function useSignOut() {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: async () => {
      await stopWebPush();
      return expectStatus(api.auth.signOut({ body: {} }), 204);
    },
    onSuccess: () => {
      queryClient.clear();
      window.location.assign('/sign-in');
    },
    onError: (error) => {
      if (isApiError(error) && error.isUnauthenticated) return;
      toast({
        tone: 'error',
        title: 'Could not sign out',
        description: isApiError(error) ? error.message : 'Please try again.',
        reference: isApiError(error) ? (error.requestId ?? undefined) : undefined,
      });
    },
  });
}
