'use client';

import type { TaskSummary } from '@lintel/api-contracts';
import { ErrorState, pageEnter } from '@lintel/design-system/web';
import { motion } from 'motion/react';
import { useState } from 'react';
import { FirstRunTip } from '@/features/guidance/first-run-tip';
import { WebPushPromptCard } from '@/features/push/web-push-prompt-card';
import { useSession } from '@/features/session/session-provider';
import { ReportBlockerSheet } from '@/features/tasks/report-blocker-sheet';
import { WorkTrackingProvider } from '@/features/tasks/work-tracking';
import { describeError } from '@/lib/api/describe-error';
import { formatLongDate, greetingFor, todayIn } from '@/lib/format/dates';
import { NextPriorityHero } from './next-priority-hero';
import { PriorityChangeNotice } from './priority-change-notice';
import { QueueSections } from './queue-sections';
import { RecentlyCompleted, ReviewsWaiting } from './today-rail';
import { TodaySkeleton } from './today-skeleton';
import { useWorkQueue } from './use-work-queue';
import { WorkloadMeter } from './workload-meter';

function summarise(counts: {
  overdue: number;
  today: number;
  waiting: number;
  needsAcknowledgement: number;
}): string {
  const parts: string[] = [];
  if (counts.overdue > 0) parts.push(`${counts.overdue} overdue`);
  if (counts.today > 0) parts.push(`${counts.today} due today`);
  if (counts.waiting > 0) parts.push(`${counts.waiting} waiting on others`);
  if (counts.needsAcknowledgement > 0)
    parts.push(`${counts.needsAcknowledgement} new to acknowledge`);
  if (parts.length === 0) return 'Nothing is due today.';
  const last = parts.pop();
  return parts.length === 0 ? `You have ${last}.` : `You have ${parts.join(', ')} and ${last}.`;
}

/** The employee's home: the one next thing, then everything else in order. */
export function TodayView() {
  const { user } = useSession();
  const { query, view, applyLatestOrder, expectReorder } = useWorkQueue();
  const [blockerTask, setBlockerTask] = useState<TaskSummary | null>(null);
  const today = view?.queue.today ?? todayIn(user.timeZone);
  const firstName = user.fullName.split(' ')[0] ?? user.fullName;

  return (
    <div className="mx-auto flex w-full max-w-[84rem] flex-col gap-8 px-5 py-6 md:px-10 md:py-9">
      <motion.header {...pageEnter} className="flex flex-col gap-1.5">
        <p className="type-body-sm text-ink-muted">{formatLongDate(today)}</p>
        <h1 className="type-display-md text-ink md:type-display-lg">
          {greetingFor(user.timeZone)}, {firstName}
        </h1>
        {view && <p className="type-body text-ink-muted">{summarise(view.queue.counts)}</p>}
      </motion.header>
      <FirstRunTip tip="today" />

      {query.isPending && <TodaySkeleton />}
      {query.isError && !view && (
        <ErrorState
          {...describeError(query.error, { resource: 'collection' })}
          onRetry={() => query.refetch()}
          retrying={query.isFetching}
        />
      )}
      {view && (
        <WorkTrackingProvider enabled={view.queue.workTrackingEnabled}>
          <NextPriorityHero
            item={view.next}
            today={today}
            onBeforeChange={expectReorder}
            onReportBlocker={() => view.next && setBlockerTask(view.next.task)}
          />
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_21rem]">
            <div className="flex min-w-0 flex-col gap-8">
              <WebPushPromptCard />
              <PriorityChangeNotice changes={view.changes} onApply={applyLatestOrder} />
              <QueueSections
                items={view.items}
                today={today}
                strategy={view.queue.strategy}
                onBeforeChange={expectReorder}
                onReportBlocker={setBlockerTask}
              />
            </div>
            <aside
              aria-label="Your day at a glance"
              className="flex flex-col gap-4 lg:sticky lg:top-6"
            >
              <WorkloadMeter workload={view.queue.workload} />
              <ReviewsWaiting tasks={view.queue.reviewsWaitingForMe} />
              <RecentlyCompleted tasks={view.queue.recentlyCompleted} />
            </aside>
          </div>
        </WorkTrackingProvider>
      )}
      <ReportBlockerSheet task={blockerTask} onClose={() => setBlockerTask(null)} />
    </div>
  );
}
