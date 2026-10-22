'use client';

import type { PeopleAway } from '@lintel/api-contracts';
import { useQuery } from '@tanstack/react-query';
import { TriangleAlert } from 'lucide-react';
import { useMemo } from 'react';
import { useSession } from '@/features/session/session-provider';
import { api, expectStatus } from '@/lib/api/api-client';
import { formatCalendarDate, todayIn } from '@/lib/format/dates';

type PersonAway = PeopleAway['people'][number];

/**
 * Who is on leave (or has asked for it) while the task runs. Only people who
 * may change the task's owner can ask; for anyone else the warning simply
 * does not show (`enabled` false, or the API refuses).
 */
export function usePeopleAway(taskId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['leave', 'away-during-task', taskId] as const,
    queryFn: () => expectStatus(api.leave.peopleAwayDuringTask({ params: { id: taskId } }), 200),
    enabled,
    staleTime: 60_000,
    retry: false,
  });
}

/** "is on leave from 2 Nov to 3 Nov" / "has asked for leave on 2 Nov". */
export function awayPhrase(absences: readonly PersonAway[], today: string): string {
  const dates = absences
    .map((absence) =>
      absence.startDate === absence.endDate
        ? `on ${formatCalendarDate(absence.startDate, today)}`
        : `from ${formatCalendarDate(absence.startDate, today)} to ${formatCalendarDate(absence.endDate, today)}`,
    )
    .join(' and ');
  return absences.some((absence) => absence.status === 'approved')
    ? `is on leave ${dates}`
    : `has asked for leave ${dates}`;
}

/** Absences by person, plus a short label per person for the picker. */
export function useAwayByPerson(taskId: string, enabled: boolean) {
  const { user } = useSession();
  const today = todayIn(user.timeZone);
  const away = usePeopleAway(taskId, enabled);
  return useMemo(() => {
    const byPerson = new Map<string, PersonAway[]>();
    for (const absence of away.data?.people ?? []) {
      byPerson.set(absence.user.id, [...(byPerson.get(absence.user.id) ?? []), absence]);
    }
    const labels = new Map<string, string>();
    for (const [userId, absences] of byPerson) {
      const phrase = awayPhrase(absences, today);
      labels.set(userId, phrase.charAt(0).toUpperCase() + phrase.slice(1));
    }
    return { byPerson, labels, today };
  }, [away.data, today]);
}

/**
 * Warns, without blocking, that the chosen person is away during the task:
 * "Sameer is on leave 2 Nov to 3 Nov, during this task."
 */
export function AwayWarning({
  userId,
  away,
}: {
  readonly userId: string | null;
  readonly away: ReturnType<typeof useAwayByPerson>;
}) {
  const absences = userId ? away.byPerson.get(userId) : undefined;
  const first = absences?.[0];
  return (
    <div role="status" aria-live="polite">
      {first && absences && (
        <p className="flex items-start gap-2 rounded-md border border-at-risk-solid/30 bg-at-risk-tint/50 px-3 py-2 type-body-sm text-ink">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-at-risk" />
          <span>
            {first.user.fullName.split(' ')[0]} {awayPhrase(absences, away.today)}, during this
            task. You can still choose them.
          </span>
        </p>
      )}
    </div>
  );
}
