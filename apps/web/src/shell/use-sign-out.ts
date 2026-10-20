'use client';

import { useToast } from '@lintel/design-system/web';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, expectStatus } from '@/lib/api/api-client';
import { isApiError } from '@/lib/api/api-error';

/** Ends the session on the server, forgets cached data and returns to sign-in. */
export function useSignOut() {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: () => expectStatus(api.auth.signOut({ body: {} }), 204),
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
