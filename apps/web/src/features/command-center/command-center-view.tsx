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
import { FirstRunTip } from '@/features/guidance/first-run-tip';
import { InsightFilterBar } from '@/features/insights/insight-filter-bar';
import { useFilterOptions } from '@/features/insights/use-filter-options';
import { useInsightFilters } from '@/features/insights/use-insight-filters';
import { ProjectCard } from '@/features/projects/project-card';
import { useSession } from '@/features/session/session-provider';
import { api, expectStatus } from '@/lib/api/api-client';
import { describeError } from '@/lib/api/describe-error';
import { formatCalendarDate, formatRelativeInstant, todayIn } from '@/lib/format/dates';
import { CommandCenterBudgets } from './command-center-budgets';
import { CommandCenterKpis } from './command-center-kpis';
import {
  DecisionsWaiting,
  StuckWork,
  TeamPulse,
  UpcomingMilestones,
} from './command-center-panels';

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
      <FirstRunTip tip="command_center" />
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
        <div
          aria-busy={center.isPlaceholderData}
          className={
            center.isPlaceholderData
              ? 'flex flex-col gap-8 opacity-60 transition-opacity'
              : 'flex flex-col gap-8 transition-opacity'
          }
        >
          <CommandCenterKpis data={data} today={today} />
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
            <div className="flex min-w-0 flex-col gap-6">
              <section className="flex flex-col gap-3">
                <h2 className="type-title-md text-ink">Projects needing attention</h2>
                {data.projectsNeedingAttention.length === 0 ? (
                  <p className="type-body-sm text-ink-faint">
                    {narrowed
                      ? 'Every open project in this view is on track.'
                      : 'Every open project is on track.'}
                  </p>
                ) : (
                  <ul className="grid gap-4 md:grid-cols-2">
                    {data.projectsNeedingAttention.map((project, index) => (
                      <ProjectCard key={project.id} project={project} today={today} index={index} />
                    ))}
                  </ul>
                )}
              </section>
              <UpcomingMilestones data={data} today={today} filtered={Boolean(narrowed)} />
              {data.profitability && <CommandCenterBudgets portfolio={data.profitability} />}
            </div>
            <div className="flex min-w-0 flex-col gap-6">
              <DecisionsWaiting data={data} />
              <StuckWork data={data} today={today} />
              <TeamPulse data={data} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
