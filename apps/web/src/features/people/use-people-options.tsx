'use client';

import { Avatar, type ComboboxOption } from '@lintel/design-system/web';
import { ROLE_LABELS } from '@lintel/domain';
import { useQuery } from '@tanstack/react-query';
import { useDeferredValue, useMemo, useState } from 'react';
import { api, expectStatus } from '@/lib/api/api-client';
import { queryKeys } from '@/lib/query/query-keys';

/** Active people as combobox options, searched on the server as the person types. */
export function usePeopleOptions() {
  const [search, setSearch] = useState('');
  const deferred = useDeferredValue(search.trim());
  const filters = { search: deferred, status: 'active', pageSize: 50 } as const;
  const query = useQuery({
    queryKey: queryKeys.people(filters),
    queryFn: () =>
      expectStatus(
        api.people.listPeople({
          query: {
            page: 1,
            pageSize: 50,
            status: 'active',
            ...(deferred ? { search: deferred } : {}),
          },
        }),
        200,
      ),
    staleTime: 5 * 60_000,
    placeholderData: (previous) => previous,
  });
  const options = useMemo<ComboboxOption[]>(
    () =>
      (query.data?.items ?? []).map((person) => ({
        value: person.id,
        label: person.fullName,
        description: person.designation ?? ROLE_LABELS[person.role],
        leading: <Avatar name={person.fullName} hue={person.avatarHue} size="xs" decorative />,
      })),
    [query.data],
  );
  return {
    options,
    onQueryChange: setSearch,
    loading: query.isFetching,
    people: query.data?.items ?? [],
  };
}
