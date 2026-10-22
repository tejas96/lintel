import type { TaskAwayWindow } from '@lintel/application';
import type { DayPortion } from '@lintel/domain';
import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { leaveRequests, users } from '../../schema';
import { loadUserSummaries } from '../shared/user-summary.query';
import type { UserSummaryView } from '../shared/view-types';

export interface PersonAwayView {
  readonly user: UserSummaryView;
  readonly startDate: string;
  readonly endDate: string;
  readonly dayPortion: DayPortion;
  /** Approved leave (urgent absences included), or a request still waiting for a decision. */
  readonly status: 'approved' | 'requested';
}

export interface PeopleAwayView {
  readonly taskId: string;
  readonly window: { readonly start: string; readonly end: string };
  readonly people: PersonAwayView[];
}

/**
 * Active people with leave approved or waiting for a decision that touches the
 * window. Dates and status only: never the leave type or the reason.
 */
export async function loadPeopleAway(
  db: DatabaseExecutor,
  window: TaskAwayWindow,
): Promise<PeopleAwayView> {
  const rows = await db
    .select({
      userId: leaveRequests.userId,
      startDate: leaveRequests.startDate,
      endDate: leaveRequests.endDate,
      dayPortion: leaveRequests.dayPortion,
      status: leaveRequests.status,
    })
    .from(leaveRequests)
    .innerJoin(users, eq(users.id, leaveRequests.userId))
    .where(
      and(
        eq(users.status, 'active'),
        inArray(leaveRequests.status, ['pending', 'info_requested', 'approved']),
        lte(leaveRequests.startDate, window.end),
        gte(leaveRequests.endDate, window.start),
      ),
    )
    .orderBy(asc(leaveRequests.startDate))
    .limit(500);
  const people = await loadUserSummaries(
    db,
    rows.map((row) => row.userId),
  );
  return {
    taskId: window.taskId,
    window: { start: window.start, end: window.end },
    people: rows.flatMap((row) => {
      const user = people.get(row.userId);
      if (!user) return [];
      const status = row.status === 'approved' ? ('approved' as const) : ('requested' as const);
      return [
        {
          user,
          startDate: row.startDate,
          endDate: row.endDate,
          dayPortion: row.dayPortion,
          status,
        },
      ];
    }),
  };
}
