'use client';

import {
  EmptyState,
  ErrorState,
  PageHeader,
  pageEnter,
  Skeleton,
  SkeletonGroup,
} from '@lintel/design-system/web';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useState } from 'react';
import { useSession } from '@/features/session/session-provider';
import { api, expectStatus } from '@/lib/api/api-client';
import { describeError } from '@/lib/api/describe-error';
import { addDays, todayIn } from '@/lib/format/dates';
import { queryKeys } from '@/lib/query/query-keys';
import { CapacityControls } from './capacity-controls';
import { CapacityGrid } from './capacity-grid';
import { CapacityPersonCard } from './capacity-person-card';
import { CapacityLegend, CapacitySummary } from './capacity-summary';
import { type CapacitySpan, rangeOf, SPAN_DAYS, startOfWeek, useCapacity } from './use-capacity';

const FRAME = 'mx-auto flex w-full max-w-[84rem] flex-col gap-6 px-5 py-6 md:px-10 md:py-9';

/** Team capacity: who has room, who is stretched, and why, day by day. */
export function CapacityView() {
  const { user, can } = useSession();
  const today = todayIn(user.timeZone);
  const thisWeek = startOfWeek(today);
  const [span, setSpan] = useState<CapacitySpan>('week');
  const [start, setStart] = useState(thisWeek);
  const [teamId, setTeamId] = useState<string | null>(null);
  const range = rangeOf(start, span);
  const allowed = can('capacity.view_team', 'capacity.view_all');
  const capacity = useCapacity(range, teamId);
  const teams = useQuery({
    queryKey: queryKeys.teams,
    queryFn: () => expectStatus(api.people.listTeams(), 200),
    enabled: can('capacity.view_all'),
  });

  if (!allowed) {
    return (
      <div className={FRAME}>
        <ErrorState
          kind="forbidden"
          title="Team capacity is for leads and managers"
          message="Your own load for today is on the Today screen. Ask a studio administrator if you need to see your team’s."
        />
      </div>
    );
  }

  return (
    <div className={FRAME}>
      <motion.div {...pageEnter}>
        <PageHeader
          title="Capacity"
          description={
            can('capacity.view_all')
              ? 'Booked work against each person’s available time, across the studio.'
              : 'Booked work against available time for your team and the people who report to you.'
          }
        />
      </motion.div>
      <CapacityControls
        range={range}
        span={span}
        onSpanChange={setSpan}
        onStep={(direction) => setStart((current) => addDays(current, direction * SPAN_DAYS[span]))}
        onToday={start === thisWeek ? null : () => setStart(thisWeek)}
        teams={teams.data ?? []}
        teamId={teamId}
        onTeamChange={setTeamId}
      />
      {capacity.isPending && (
        <SkeletonGroup label="Loading capacity" className="flex flex-col gap-3">
          <Skeleton className="h-8 w-80" />
          <Skeleton className="h-[26rem] rounded-lg" />
        </SkeletonGroup>
      )}
      {capacity.isError && !capacity.data && (
        <ErrorState
          {...describeError(capacity.error, { resource: 'collection' })}
          onRetry={() => capacity.refetch()}
          retrying={capacity.isFetching}
        />
      )}
      {capacity.data && capacity.data.people.length === 0 && (
        <EmptyState
          drawing="chair"
          title="Nobody to show"
          description="No active people match this team. Choose another team or every team."
        />
      )}
      {capacity.data && capacity.data.people.length > 0 && (
        <div
          className={
            capacity.isPlaceholderData
              ? 'flex flex-col gap-5 opacity-60 transition-opacity'
              : 'flex flex-col gap-5 transition-opacity'
          }
        >
          <CapacitySummary overview={capacity.data} />
          <div className="hidden md:block">
            <CapacityGrid overview={capacity.data} today={today} compact={span === 'fortnight'} />
          </div>
          <ul className="flex flex-col gap-2 md:hidden">
            {capacity.data.people.map((person, index) => (
              <CapacityPersonCard
                key={person.user.id}
                person={person}
                holidays={capacity.data.holidays}
                today={today}
                index={index}
              />
            ))}
          </ul>
          <CapacityLegend />
        </div>
      )}
    </div>
  );
}
