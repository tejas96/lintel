'use client';

import type { ProjectType } from '@lintel/domain';
import { useQuery } from '@tanstack/react-query';
import { api, expectStatus } from '@/lib/api/api-client';
import { queryKeys } from '@/lib/query/query-keys';

export function useTemplates(projectType: ProjectType) {
  return useQuery({
    queryKey: queryKeys.templates(projectType),
    queryFn: () =>
      expectStatus(
        api.templates.listTemplates({ query: { projectType, includeArchived: false } }),
        200,
      ),
    staleTime: 5 * 60_000,
  });
}

/** The template with its published version's definition (stages, tasks, options). */
export function usePublishedTemplate(templateId: string | null) {
  const query = useQuery({
    queryKey: queryKeys.template(templateId ?? 'none'),
    queryFn: () =>
      expectStatus(api.templates.getTemplate({ params: { id: templateId ?? '' } }), 200),
    enabled: templateId !== null,
    staleTime: 5 * 60_000,
  });
  const version = query.data?.versions.find((candidate) => candidate.status === 'published');
  return { ...query, version };
}
