'use client';

import type { ProjectDocument } from '@lintel/api-contracts';
import { useToast } from '@lintel/design-system/web';
import type { DocumentFolder, DocumentVisibility } from '@lintel/domain';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, expectStatus } from '@/lib/api/api-client';
import { queryKeys } from '@/lib/query/query-keys';
import { useFailureToast } from '@/lib/query/use-failure-toast';

export type KindFilter = 'all' | 'image' | 'pdf' | 'drawing' | 'office';

export interface LibraryFilters {
  readonly folder: DocumentFolder | 'all';
  readonly kind: KindFilter;
  readonly search: string;
}

const PAGE_SIZE = 24;

/** The library, a page at a time ("Show more"), with the same filters the server applies. */
export function useDocumentLibrary(projectId: string, filters: LibraryFilters) {
  return useInfiniteQuery({
    queryKey: queryKeys.projectDocuments(projectId, { ...filters }),
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      expectStatus(
        api.documents.listProjectDocuments({
          params: { id: projectId },
          query: {
            page: pageParam,
            pageSize: PAGE_SIZE,
            ...(filters.folder === 'all' ? {} : { folder: filters.folder }),
            ...(filters.kind === 'all' ? {} : { kind: filters.kind }),
            ...(filters.search.trim() ? { search: filters.search.trim() } : {}),
          },
        }),
        200,
      ),
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    placeholderData: (previous) => previous,
  });
}

export interface NewDocument {
  readonly file: File;
  readonly title: string;
  readonly folder: DocumentFolder;
  readonly visibility: DocumentVisibility;
}

/**
 * The multipart body, built by hand: the contract client would JSON-encode
 * the text fields, which the server rightly refuses.
 */
function documentForm(input: NewDocument): FormData {
  const form = new FormData();
  form.append('file', input.file);
  form.append('title', input.title);
  form.append('folder', input.folder);
  form.append('visibility', input.visibility);
  return form;
}

/** Add and archive. Both refresh the library and the project's activity. */
export function useDocumentMutations(projectId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const fail = useFailureToast();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.allProjectDocuments(projectId) });
    void queryClient.invalidateQueries({ queryKey: ['projects', 'detail', projectId, 'activity'] });
  };
  const upload = useMutation({
    mutationFn: (input: NewDocument) =>
      expectStatus(
        api.documents.uploadProjectDocument({
          params: { id: projectId },
          body: documentForm(input),
        }),
        201,
      ),
    onSuccess: (document) => {
      refresh();
      toast({ tone: 'success', title: 'Document added', description: document.title });
    },
    onError: (error) => fail(error, 'add the document'),
  });
  const archive = useMutation({
    mutationFn: (input: { document: ProjectDocument; reason: string | null }) =>
      expectStatus(
        api.documents.archiveDocument({
          params: { id: input.document.id },
          body: { reason: input.reason, version: input.document.version },
        }),
        200,
      ),
    onSuccess: (document) => {
      refresh();
      toast({ tone: 'success', title: 'Document archived', description: document.title });
    },
    onError: (error) =>
      fail(error, 'archive the document', [queryKeys.allProjectDocuments(projectId)]),
  });
  return { upload, archive };
}
