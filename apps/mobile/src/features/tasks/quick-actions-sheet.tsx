import type { TaskDetail } from '@lintel/api-contracts';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { errorMessage } from '@/api/api-error';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { SheetLayout } from '@/components/sheet-layout';
import { SkeletonList } from '@/components/skeleton';
import { InlineError } from '@/components/state-views';
import { useToast } from '@/feedback/toast';
import { useTask } from '@/queries/task-queries';
import { usePauseWork, useStartWork } from '@/queries/work-queries';
import { useCurrentUser } from '@/session/session-provider';
import { useAppTheme } from '@/theme/app-theme';
import { SPACE } from '@/theme/layout';
import { canBeginWork, canReportBlocker } from './task-affordances';
import { useRunTransition } from './use-run-transition';

/**
 * Long-press / "More" sheet: start or pause, every status change the server
 * allows (with reasons for the ones it doesn't), and report a blocker.
 */
export function QuickActionsSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const task = useTask(id);
  if (!task.data) {
    return (
      <SheetLayout title="Task actions">
        {task.isError ? (
          <InlineError error={task.error} onRetry={() => void task.refetch()} />
        ) : (
          <SkeletonList count={2} />
        )}
      </SheetLayout>
    );
  }
  return <LoadedQuickActions task={task.data} />;
}

function LoadedQuickActions({ task }: { readonly task: TaskDetail }) {
  const user = useCurrentUser();
  const router = useRouter();
  const toast = useToast();
  const { colors } = useAppTheme();
  const startWork = useStartWork();
  const pauseWork = usePauseWork();
  const close = () => {
    if (router.canGoBack()) router.back();
  };
  const transition = useRunTransition(task);
  const tracking = task.workTrackingEnabled;
  const active = tracking && task.activeWorkSessionStartedAt !== null;
  const canStart = tracking && canBeginWork(task, user.id);
  const notify = { onError: (error: unknown) => toast.show(errorMessage(error), 'error') };

  return (
    <SheetLayout title={task.title} subtitle={`${task.project.name} · #${task.number}`}>
      <View style={styles.group}>
        {active ? (
          <Button
            label="Pause work"
            icon="pause"
            variant="secondary"
            size="lg"
            loading={pauseWork.isPending}
            onPress={() =>
              pauseWork.mutate(task.id, {
                ...notify,
                onSuccess: () => {
                  toast.show('Paused.', 'success');
                  close();
                },
              })
            }
          />
        ) : canStart ? (
          <Button
            label="Start work"
            icon="play"
            size="lg"
            loading={startWork.isPending}
            onPress={() =>
              startWork.mutate(task.id, {
                ...notify,
                onSuccess: () => {
                  toast.show('Work started.', 'success');
                  close();
                },
              })
            }
          />
        ) : null}
        {task.transitions
          .filter(
            // With time tracking, "Start work" above covers the move to in progress.
            (option) =>
              option.allowed &&
              option.to !== 'blocked' &&
              !(tracking && option.to === 'in_progress'),
          )
          .map((option) => (
            <Button
              key={option.to}
              label={option.label}
              variant={option.to === 'cancelled' ? 'danger' : 'secondary'}
              size="lg"
              loading={transition.pendingTo === option.to}
              onPress={() => transition.run(option, close)}
            />
          ))}
        {!canReportBlocker(task, user.id) ? null : (
          <Button
            label="Report a blocker"
            icon="blocked"
            variant="secondary"
            size="lg"
            onPress={() =>
              router.replace({ pathname: '/tasks/[id]/blocker', params: { id: task.id } })
            }
          />
        )}
        <Button
          label="Open task"
          variant="quiet"
          onPress={() => router.replace({ pathname: '/tasks/[id]', params: { id: task.id } })}
        />
      </View>
      {task.transitions
        .filter((option) => !option.allowed && option.to !== 'blocked' && option.reasons.length > 0)
        .map((option) => (
          <View key={option.to} style={styles.refused}>
            <Icon name="lock" size={14} color={colors.textTertiary} />
            <AppText variant="bodySm" tone="secondary" style={styles.flex}>
              {option.label}: {option.reasons.join(' ')}
            </AppText>
          </View>
        ))}
    </SheetLayout>
  );
}

const styles = StyleSheet.create({
  group: { gap: SPACE.sm },
  refused: { flexDirection: 'row', gap: SPACE.sm, alignItems: 'flex-start' },
  flex: { flex: 1 },
});
