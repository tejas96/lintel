'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, expectStatus } from '@/lib/api/api-client';
import { addDays, weekdayOf } from '@/lib/format/dates';

export type CapacitySpan = 'week' | 'fortnight';

export const SPAN_DAYS: Readonly<Record<CapacitySpan, number>> = { week: 7, fortnight: 14 };

/** The Monday of the week a date falls in. */
export function startOfWeek(date: string): string {
  return addDays(date, -((weekdayOf(date) + 6) % 7));
}

export interface CapacityRange {
  readonly from: string;
  readonly to: string;
}

export function rangeOf(start: string, span: CapacitySpan): CapacityRange {
  return { from: start, to: addDays(start, SPAN_DAYS[span] - 1) };
}

export const capacityKey = (range: CapacityRange, teamId: string | null) =>
  ['capacity', range.from, range.to, teamId ?? 'all'] as const;

/**
 * Workload against availability for the people the server lets this person
 * see. The previous range stays on screen while the next one loads.
 */
export function useCapacity(range: CapacityRange, teamId: string | null) {
  return useQuery({
    queryKey: capacityKey(range, teamId),
    queryFn: () =>
      expectStatus(
        api.operations.capacity({
          query: { from: range.from, to: range.to, ...(teamId ? { teamId } : {}) },
        }),
        200,
      ),
    placeholderData: keepPreviousData,
  });
}
