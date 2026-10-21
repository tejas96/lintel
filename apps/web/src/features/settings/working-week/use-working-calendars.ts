'use client';

import type { ManagedWorkingCalendar } from '@lintel/api-contracts';
import type { WorkingWeek } from '@lintel/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, expectStatus } from '@/lib/api/api-client';
import { queryKeys } from '@/lib/query/query-keys';

export const workingCalendarsKey = ['settings', 'working-calendars'] as const;

export type WorkingCalendarInput = WorkingWeek & { readonly name: string };

/** Every working week, the studio week first. */
export function useWorkingCalendars(enabled = true) {
  return useQuery({
    queryKey: workingCalendarsKey,
    queryFn: () => expectStatus(api.workingCalendars.listWorkingCalendars(), 200),
    enabled,
    staleTime: 60_000,
  });
}

/** Changes refresh the list and the people directory (people counts and assignments). */
export function useWorkingCalendarMutations() {
  const queryClient = useQueryClient();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: workingCalendarsKey });
    void queryClient.invalidateQueries({ queryKey: queryKeys.allPeople });
  };
  const create = useMutation({
    mutationFn: (input: WorkingCalendarInput) =>
      expectStatus(
        api.workingCalendars.createWorkingCalendar({
          body: { ...input, workingWeekdays: [...input.workingWeekdays] },
        }),
        201,
      ),
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: (input: {
      calendar: ManagedWorkingCalendar;
      changes: Partial<WorkingCalendarInput>;
    }) => {
      const { workingWeekdays, ...rest } = input.changes;
      return expectStatus(
        api.workingCalendars.updateWorkingCalendar({
          params: { id: input.calendar.id },
          body: {
            ...rest,
            ...(workingWeekdays ? { workingWeekdays: [...workingWeekdays] } : {}),
            version: input.calendar.version,
          },
        }),
        200,
      );
    },
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (calendar: ManagedWorkingCalendar) =>
      expectStatus(
        api.workingCalendars.removeWorkingCalendar({ params: { id: calendar.id } }),
        204,
      ),
    onSuccess: refresh,
  });
  return { create, update, remove };
}
