'use client';

import type { TemplateDetail } from '@lintel/api-contracts';
import type { ProjectType } from '@lintel/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, expectStatus } from '@/lib/api/api-client';
import { queryKeys } from '@/lib/query/query-keys';
import type { WorkflowDefinition } from './template-types';

export const templateAdminKeys = {
  list: (includeArchived: boolean) => ['templates', 'admin', includeArchived] as const,
};

export function useTemplateList(includeArchived: boolean) {
  return useQuery({
    queryKey: templateAdminKeys.list(includeArchived),
    queryFn: () => expectStatus(api.templates.listTemplates({ query: { includeArchived } }), 200),
  });
}

export function useTemplateDetail(templateId: string) {
  return useQuery({
    queryKey: queryKeys.template(templateId),
    queryFn: () => expectStatus(api.templates.getTemplate({ params: { id: templateId } }), 200),
    // The editor holds unsaved work; never swap the definition underneath it.
    refetchOnWindowFocus: false,
  });
}

/** After any change: store the fresh detail and refresh every template list. */
function useSettle() {
  const queryClient = useQueryClient();
  return (detail: TemplateDetail) => {
    queryClient.setQueryData(queryKeys.template(detail.id), detail);
    void queryClient.invalidateQueries({ queryKey: ['templates'], exact: false });
  };
}

export function useCreateTemplate() {
  const settle = useSettle();
  return useMutation({
    mutationFn: (input: {
      name: string;
      description: string | null;
      projectType: ProjectType;
      copyFromVersionId: string | null;
    }) => expectStatus(api.templates.createTemplate({ body: input }), 201),
    onSuccess: settle,
  });
}

export function useSaveDraft(templateId: string) {
  const settle = useSettle();
  return useMutation({
    mutationFn: (input: {
      definition: WorkflowDefinition;
      changeNotes: string | null;
      version: number | null;
    }) => expectStatus(api.templates.saveDraft({ params: { id: templateId }, body: input }), 200),
    onSuccess: settle,
  });
}

export function usePublishDraft(templateId: string) {
  const settle = useSettle();
  return useMutation({
    mutationFn: (version: number) =>
      expectStatus(
        api.templates.publishDraft({ params: { id: templateId }, body: { version } }),
        200,
      ),
    onSuccess: settle,
  });
}

export function useArchiveTemplate(templateId: string) {
  const settle = useSettle();
  return useMutation({
    mutationFn: () =>
      expectStatus(api.templates.archiveTemplate({ params: { id: templateId }, body: {} }), 200),
    onSuccess: settle,
  });
}
