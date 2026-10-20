import type { WorkQueueItem } from '@lintel/api-contracts';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { errorMessage } from '@/api/api-error';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { TaskContextLine, TaskFacts } from '@/features/tasks/task-meta';
import { useToast } from '@/feedback/toast';
import { formatElapsed } from '@/formatting/quantities';
import { useTask } from '@/queries/task-queries';
import { usePauseWork, useStartWork } from '@/queries/work-queries';
import { useAppTheme } from '@/theme/app-theme';
import { SPACE } from '@/theme/layout';
import { listEntrance } from '@/theme/motion';
import { useElapsedSeconds } from './use-elapsed-seconds';

/**
 * The server's pick for what to do next, with its own headline and reasons.
 * The live task detail tells whether a work session is already running.
 */
export function NextUpCard({
  item,
  today,
}: {
  readonly item: WorkQueueItem;
  readonly today: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const { colors } = useAppTheme();
  const detail = useTask(item.task.id);
  const startWork = useStartWork();
  const pauseWork = usePauseWork();
  const activeSince = detail.data?.activeWorkSessionStartedAt ?? null;
  const elapsed = useElapsedSeconds(activeSince);
  const busy = startWork.isPending || pauseWork.isPending;

  const start = () =>
    startWork.mutate(item.task.id, {
      onSuccess: () => toast.show('Work started. The timer is running.', 'success'),
      onError: (error) => toast.show(errorMessage(error), 'error'),
    });
  const pause = () =>
    pauseWork.mutate(item.task.id, {
      onSuccess: () => toast.show('Paused. Your time so far is saved.', 'success'),
      onError: (error) => toast.show(errorMessage(error), 'error'),
    });

  return (
    <Animated.View entering={listEntrance(0)}>
      <Card tone="raised" style={styles.card}>
        <View style={styles.overlineRow}>
          <AppText variant="overline" tone="accent">
            Next up
          </AppText>
          {elapsed !== null ? (
            <View
              style={styles.live}
              accessible
              accessibilityLabel={`Working for ${formatElapsed(elapsed)}`}
            >
              <View style={[styles.dot, { backgroundColor: colors.accent }]} />
              <AppText variant="mono" tone="accent">
                {formatElapsed(elapsed)}
              </AppText>
            </View>
          ) : null}
        </View>
        <TaskContextLine task={item.task} />
        <AppText variant="displayMd">{item.task.title}</AppText>
        <AppText variant="body">{item.headline}</AppText>
        {item.reasons.length > 0 ? (
          <View style={styles.reasons} accessibilityLabel="Why this is first">
            {item.reasons.slice(0, 3).map((reason) => (
              <View key={reason.code} style={styles.reason}>
                <View style={[styles.bullet, { backgroundColor: colors.borderStrong }]} />
                <AppText variant="bodySm" tone="secondary" style={styles.reasonText}>
                  {reason.explanation}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}
        <TaskFacts task={item.task} today={today} />
        <View style={styles.actions}>
          {activeSince ? (
            <Button
              label="Pause"
              icon="pause"
              variant="secondary"
              onPress={pause}
              loading={busy}
              fill
            />
          ) : (
            <Button label="Start work" icon="play" onPress={start} loading={busy} fill />
          )}
          <Button
            label="Open"
            variant="secondary"
            onPress={() => router.push({ pathname: '/tasks/[id]', params: { id: item.task.id } })}
            fill
          />
        </View>
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { gap: SPACE.md, padding: SPACE.xl },
  overlineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  live: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  dot: { width: 8, height: 8, borderRadius: 4 },
  reasons: { gap: SPACE.xs },
  reason: { flexDirection: 'row', gap: SPACE.sm, alignItems: 'flex-start' },
  bullet: { width: 4, height: 4, borderRadius: 2, marginTop: 8 },
  reasonText: { flex: 1 },
  actions: { flexDirection: 'row', gap: SPACE.sm, marginTop: SPACE.xs },
});
