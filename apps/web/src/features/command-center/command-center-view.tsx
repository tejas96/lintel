'use client';

import {
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
  pageEnter,
  Skeleton,
  SkeletonGroup,
} from '@lintel/design-system/web';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { InsightFilterBar } from '@/features/insights/insight-filter-bar';
import { useFilterOptions } from '@/features/insights/use-filter-options';
import { useInsightFilters } from '@/features/insights/use-insight-filters';
import { useSession } from '@/features/session/session-provider';
import { api, expectStatus } from '@/lib/api/api-client';
import { describeError } from '@/lib/api/describe-error';
import { formatCalendarDate, formatRelativeInstant, todayIn } from '@/lib/format/dates';
import { CommandCenterBody } from './command-center-body';
import { useBriefing } from './use-briefing';

/** The owner's view of the whole studio, computed live from projects, tasks and people. */
export function CommandCenterView() {
  const { user, can } = useSession();
  const today = todayIn(user.timeZone);
  const { filters, update, clear, active, query } = useInsightFilters();
  const options = useFilterOptions();
  const allowed = can('dashboard.view_business');
  const center = useQuery({
    queryKey: ['dashboard', 'command-center', query],
    queryFn: () => expectStatus(api.operations.commandCenter({ query }), 200),
    refetchInterval: 2 * 60_000,
    placeholderData: keepPreviousData,
    enabled: allowed,
  });
  const briefing = useBriefing(query, allowed);
  if (!allowed) {
    return (
      <div className="px-5 py-10">
        <ErrorState
          kind="forbidden"
          title="The command center is for the studio’s leadership"
          message="Your own work is on Today; your projects are under Projects."
        />
      </div>
    );
  }
  const data = center.data;
  const filtered = active > 0;
  const narrowed = filtered && (filters.projectId || filters.managerUserId || filters.teamId);
  const nothingInView =
    data !== undefined &&
    narrowed &&
    data.kpis.activeProjects.value === 0 &&
    data.projectsNeedingAttention.length === 0 &&
    data.upcomingMilestones.length === 0 &&
    data.criticalToday.length === 0 &&
    data.blockers.length === 0;
  return (
    <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-6 px-5 py-6 md:px-10 md:py-9">
      <motion.div {...pageEnter}>
        <PageHeader
          title="Studio at a glance"
          description={
            data
              ? `Live from ${narrowed ? 'the projects and people in this view' : 'every project, task and person'}, ${formatCalendarDate(data.range.start, today)} to ${formatCalendarDate(data.range.end, today)}. Updated ${formatRelativeInstant(data.generatedAt)}.`
              : 'Live from every project, task and person.'
          }
        />
      </motion.div>
      <InsightFilterBar
        filters={filters}
        onChange={update}
        onClear={clear}
        options={options}
        today={today}
        defaultPeriodLabel="Last 30 days"
      />
      {center.isPending && (
        <SkeletonGroup
          label="Loading the command center"
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          {[0, 1, 2, 3, 4, 5, 6, 7].map((tile) => (
            <Skeleton key={tile} className="h-32 rounded-lg" />
          ))}
        </SkeletonGroup>
      )}
      {center.isError && !data && (
        <ErrorState
          {...describeError(center.error, { resource: 'collection' })}
          onRetry={() => center.refetch()}
          retrying={center.isFetching}
          {...(filtered ? { actions: <Button onClick={clear}>Clear filters</Button> } : {})}
        />
      )}
      {nothingInView && (
        <EmptyState
          drawing="plan"
          title="Nothing in this view"
          description="No active project matches these filters, so there is nothing to count yet. Try another project, manager or team, or clear the filters."
          actions={<Button onClick={clear}>Clear filters</Button>}
        />
      )}
      {data && !nothingInView && (
        <CommandCenterBody
          data={data}
          briefing={briefing.data}
          today={today}
          narrowed={Boolean(narrowed)}
          stale={center.isPlaceholderData}
        />
      )}
    </div>
  );
}
