'use client';

import {
  ErrorState,
  PageHeader,
  pageEnter,
  Skeleton,
  SkeletonGroup,
} from '@lintel/design-system/web';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { ProjectCard } from '@/features/projects/project-card';
import { useSession } from '@/features/session/session-provider';
import { api, expectStatus } from '@/lib/api/api-client';
import { describeError } from '@/lib/api/describe-error';
import { formatCalendarDate, formatRelativeInstant, todayIn } from '@/lib/format/dates';
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
  const center = useQuery({
    queryKey: ['dashboard', 'command-center'],
    queryFn: () => expectStatus(api.operations.commandCenter({ query: {} }), 200),
    refetchInterval: 2 * 60_000,
    enabled: can('dashboard.view_business'),
  });
  if (!can('dashboard.view_business')) {
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
  return (
    <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-8 px-5 py-6 md:px-10 md:py-9">
      <motion.div {...pageEnter}>
        <PageHeader
          title="Studio at a glance"
          description={
            data
              ? `Live from every project, task and person, ${formatCalendarDate(data.range.start, today)} to ${formatCalendarDate(data.range.end, today)}. Updated ${formatRelativeInstant(data.generatedAt)}.`
              : 'Live from every project, task and person.'
          }
        />
      </motion.div>
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
      {center.isError && (
        <ErrorState
          {...describeError(center.error, { resource: 'collection' })}
          onRetry={() => center.refetch()}
        />
      )}
      {data && (
        <>
          <CommandCenterKpis data={data} today={today} />
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
            <div className="flex min-w-0 flex-col gap-6">
              <section className="flex flex-col gap-3">
                <h2 className="type-title-md text-ink">Projects needing attention</h2>
                {data.projectsNeedingAttention.length === 0 ? (
                  <p className="type-body-sm text-ink-faint">Every open project is on track.</p>
                ) : (
                  <ul className="grid gap-4 md:grid-cols-2">
                    {data.projectsNeedingAttention.map((project, index) => (
                      <ProjectCard key={project.id} project={project} today={today} index={index} />
                    ))}
                  </ul>
                )}
              </section>
              <UpcomingMilestones data={data} today={today} />
            </div>
            <div className="flex min-w-0 flex-col gap-6">
              <DecisionsWaiting data={data} />
              <StuckWork data={data} today={today} />
              <TeamPulse data={data} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
