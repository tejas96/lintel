'use client';

import type { Guidance } from '@lintel/api-contracts';
import { useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { queryKeys } from '@/lib/query/query-keys';

/**
 * Puts the server-fetched tips into the query cache before any screen reads
 * them, so first-run tips are decided on the first render (no late layout shift).
 */
export function GuidanceSeed({
  guidance,
  children,
}: {
  readonly guidance: Guidance | null;
  readonly children: ReactNode;
}) {
  const queryClient = useQueryClient();
  useState(() => {
    if (guidance && !queryClient.getQueryData(queryKeys.guidance)) {
      queryClient.setQueryData(queryKeys.guidance, guidance);
    }
    return null;
  });
  return children;
}
