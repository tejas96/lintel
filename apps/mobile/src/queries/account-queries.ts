import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/api/api-client';
import { queryKeys } from '@/api/query-keys';

export function useSessions() {
  return useQuery({
    queryKey: queryKeys.sessions,
    queryFn: ({ signal }) => unwrap(api.auth.listSessions({ fetchOptions: { signal } })),
  });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      unwrap(api.auth.revokeSession({ params: { id: sessionId } })),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.sessions }),
  });
}

/** Studio directory search, used to pick a colleague (handovers, "waiting on"). */
export function usePeopleSearch(search: string) {
  return useQuery({
    queryKey: queryKeys.people(search),
    queryFn: ({ signal }) =>
      unwrap(
        api.people.listPeople({
          query: { page: 1, pageSize: 20, status: 'active', ...(search ? { search } : {}) },
          fetchOptions: { signal },
        }),
      ),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
}
