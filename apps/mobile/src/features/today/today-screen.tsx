import { calendarDateInTimeZone } from '@lintel/shared';
import { View } from 'react-native';
import { errorMessage } from '@/api/api-error';
import { AccountButton } from '@/components/account-button';
import { PageHeader, ScreenScroll } from '@/components/screen';
import { SkeletonBlock, SkeletonGroup, SkeletonList } from '@/components/skeleton';
import { EmptyState, ErrorState } from '@/components/state-views';
import { useToast } from '@/feedback/toast';
import { formatLongDate, greetingFor } from '@/formatting/dates';
import { useStartWork, useWorkQueue } from '@/queries/work-queries';
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
  const firstName = user.fullName.split(' ')[0] ?? user.fullName;
  const today = queue.data?.today ?? calendarDateInTimeZone(new Date(), user.timeZone);

  const start = (taskId: string) =>
    startWork.mutate(taskId, {
      onSuccess: (task) => toast.show(`Started “${task.title}”.`, 'success'),
      onError: (error) => toast.show(errorMessage(error), 'error'),
    });

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
      {queue.isError ? (
        <ErrorState
          error={queue.error}
          subject="your work queue"
          onRetry={() => void queue.refetch()}
        />
      ) : null}
      {queue.isError ? <PushPromptCard /> : null}
      {queue.data ? (
        <>
          <WorkloadStrip workload={queue.data.workload} />
          {queue.data.next ? (
            <NextUpCard item={queue.data.next} today={queue.data.today} />
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
