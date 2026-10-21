import { calendarDateInTimeZone } from '@lintel/shared';
import { View } from 'react-native';
import { errorMessage } from '@/api/api-error';
import { AccountButton } from '@/components/account-button';
import { PageHeader, ScreenScroll } from '@/components/screen';
import { SkeletonBlock, SkeletonGroup, SkeletonList } from '@/components/skeleton';
import { EmptyState, ErrorState } from '@/components/state-views';
import { useToast } from '@/feedback/toast';
import { formatLongDate, greetingFor } from '@/formatting/dates';
import { useStartTask, useStartWork, useWorkQueue } from '@/queries/work-queries';
import { useCurrentUser } from '@/session/session-provider';
import { SPACE } from '@/theme/layout';
import { NextUpCard } from './next-up-card';
import { PushPromptCard } from './push-prompt-card';
import { QueueSections } from './queue-sections';
import { ReviewsWaiting } from './reviews-waiting';
import { WorkloadStrip } from './workload-strip';

/** The day, as the server prioritised it: next priority first, then each bucket. */
export function TodayScreen() {
  const user = useCurrentUser();
  const toast = useToast();
  const queue = useWorkQueue();
  const startWork = useStartWork();
  const startTask = useStartTask();
  const firstName = user.fullName.split(' ')[0] ?? user.fullName;
  const today = queue.data?.today ?? calendarDateInTimeZone(new Date(), user.timeZone);

  const notify = {
    onSuccess: (task: { title: string }) => toast.show(`Started “${task.title}”.`, 'success'),
    onError: (error: unknown) => toast.show(errorMessage(error), 'error'),
  };
  const start = (taskId: string) => {
    const item = queue.data?.items.find((candidate) => candidate.task.id === taskId);
    // Without time tracking, starting is a plain status move.
    if (queue.data?.workTrackingEnabled === false) {
      if (item) startTask.mutate({ taskId, version: item.task.version }, notify);
      return;
    }
    startWork.mutate(taskId, notify);
  };

  return (
    <ScreenScroll edge="tab" onRefresh={() => queue.refetch()}>
      <PageHeader
        overline={formatLongDate(today)}
        title={`${greetingFor()}, ${firstName}`}
        trailing={<AccountButton />}
      />
      {queue.isPending ? (
        <SkeletonGroup label="Loading your day">
          <View style={{ gap: SPACE.lg }}>
            <SkeletonBlock height={8} />
            <SkeletonBlock height={220} radius={16} />
          </View>
        </SkeletonGroup>
      ) : null}
      {queue.isPending ? <SkeletonList count={3} /> : null}
      {queue.isError && !queue.data ? (
        <>
          <ErrorState
            error={queue.error}
            subject="your work queue"
            onRetry={() => void queue.refetch()}
          />
          <PushPromptCard />
        </>
      ) : null}
      {queue.data ? (
        <>
          <WorkloadStrip workload={queue.data.workload} />
          {queue.data.next ? (
            <NextUpCard
              item={queue.data.next}
              today={queue.data.today}
              workTracking={queue.data.workTrackingEnabled}
            />
          ) : (
            <EmptyState
              icon="done"
              title="Nothing needs you right now"
              message="Your queue is clear. New assignments and review requests will appear here."
            />
          )}
          <PushPromptCard />
          <ReviewsWaiting tasks={queue.data.reviewsWaitingForMe} today={queue.data.today} />
          <QueueSections queue={queue.data} onStart={start} />
        </>
      ) : null}
    </ScreenScroll>
  );
}
