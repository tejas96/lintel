'use client';

import { useToast } from '@lintel/design-system/web';
import { type QueryKey, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { isApiError } from '@/lib/api/api-error';

/**
 * Explains a failed change in a toast. A stale version (someone else saved
 * first) refreshes the affected data and says so; other refusals show the
 * server's reason and request id.
 */
export function useFailureToast() {
  const toast = useToast();
  const queryClient = useQueryClient();
  return useCallback(
    (error: unknown, action: string, refresh: readonly QueryKey[] = []) => {
      if (!isApiError(error)) {
        toast({ tone: 'error', title: `Couldn’t ${action}`, description: 'Please try again.' });
        return;
      }
      if (error.isUnauthenticated) return;
      if (error.isStaleVersion) {
        for (const key of refresh) void queryClient.invalidateQueries({ queryKey: key });
        toast({
          tone: 'info',
          title: 'Someone else changed this first',
          description: 'We’ve loaded the latest version. Check it, then try again.',
        });
        return;
      }
      const details = error.details
        .map((detail) => detail.message)
        .filter((message) => message !== error.message);
      toast({
        tone: 'error',
        title: `Couldn’t ${action}`,
        description: [error.message, ...details].join(' '),
        reference: error.status >= 500 ? (error.requestId ?? undefined) : undefined,
      });
    },
    [toast, queryClient],
  );
}
