'use client';

import { useQuery } from '@tanstack/react-query';
import { api, expectStatus } from '@/lib/api/api-client';
import { queryKeys } from '@/lib/query/query-keys';

/** Full task detail, including the status changes the viewer may make. */
export function useTask(taskId: string | null) {
  return useQuery({
    queryKey: queryKeys.task(taskId ?? 'none'),
    queryFn: () => expectStatus(api.tasks.getTask({ params: { id: taskId ?? '' } }), 200),
    enabled: taskId !== null,
  });
}
