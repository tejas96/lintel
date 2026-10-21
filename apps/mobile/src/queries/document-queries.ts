import type { DocumentFolder } from '@lintel/domain';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/api/api-client';
import { queryKeys } from '@/api/query-keys';

const PAGE_SIZE = 20;

/** The project's document library, newest first, a page at a time. */
export function useProjectDocuments(projectId: string, folder: DocumentFolder | 'all') {
  return useInfiniteQuery({
    queryKey: queryKeys.projectDocuments(projectId, folder),
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      unwrap(
        api.documents.listProjectDocuments({
          params: { id: projectId },
          query: {
            page: pageParam,
            pageSize: PAGE_SIZE,
            ...(folder === 'all' ? {} : { folder }),
          },
          fetchOptions: { signal },
        }),
      ),
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });
}

export function useDocument(documentId: string) {
  return useQuery({
    queryKey: queryKeys.document(documentId),
    queryFn: ({ signal }) =>
      unwrap(api.documents.getDocument({ params: { id: documentId }, fetchOptions: { signal } })),
  });
}
