import type { WorkQueueItem } from '@lintel/api-contracts';
import { useRouter } from 'expo-router';
import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import { AppText } from '@/components/app-text';
import { PressableScale } from '@/components/pressable-scale';
import { TaskContextLine, TaskFacts } from '@/features/tasks/task-meta';
import { haptics } from '@/feedback/haptics';
import { useAppTheme } from '@/theme/app-theme';
import { HAIRLINE, RADIUS, SPACE } from '@/theme/layout';
import { SwipeAction } from './swipe-action';

export interface QueueRowProps {
  readonly item: WorkQueueItem;
  readonly today: string;
  /** Start is offered only where the server placed the task in a workable bucket. */
  readonly canStart: boolean;
  readonly onStart: (taskId: string) => void;
}

/**
 * A task in the day's queue. Tap opens it; swipe right to start; swipe left
 * to report a blocker or see every action; long-press for the action sheet.
 */
export function QueueRow({ item, today, canStart, onStart }: QueueRowProps) {
  const { task } = item;
  const router = useRouter();
  const { colors, status } = useAppTheme();
  const swipeable = useRef<SwipeableMethods>(null);
  const openTask = () => router.push({ pathname: '/tasks/[id]', params: { id: task.id } });
  const openActions = () => {
    haptics.press();
    router.push({ pathname: '/tasks/[id]/actions', params: { id: task.id } });
  };
  const openBlocker = () =>
    router.push({ pathname: '/tasks/[id]/blocker', params: { id: task.id } });
  const close = () => swipeable.current?.close();

  return (
    <ReanimatedSwipeable
      ref={swipeable}
      friction={1.6}
      overshootFriction={8}
      leftThreshold={56}
      rightThreshold={56}
      onSwipeableWillOpen={() => haptics.threshold()}
      renderLeftActions={(progress) =>
        canStart ? (
          <SwipeAction
            label="Start"
            icon="play"
            background={status.onTrack.tint}
            foreground={status.onTrack.fg}
            progress={progress}
            onPress={() => {
              close();
              onStart(task.id);
            }}
          />
        ) : null
      }
      renderRightActions={(progress) => (
        <View style={styles.rightActions}>
          <SwipeAction
            label="Blocker"
            icon="blocked"
            background={status.blocked.tint}
            foreground={status.blocked.fg}
            progress={progress}
            onPress={() => {
              close();
              openBlocker();
            }}
          />
          <SwipeAction
            label="More"
            icon="more"
            background={colors.surfaceSunken}
            foreground={colors.textPrimary}
            progress={progress}
            onPress={() => {
              close();
              openActions();
            }}
          />
        </View>
      )}
    >
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${task.title}. ${item.headline}`}
        accessibilityHint="Opens the task. Swipe or use actions to start or report a blocker."
        accessibilityActions={[
          ...(canStart ? [{ name: 'start', label: 'Start work' }] : []),
          { name: 'blocker', label: 'Report a blocker' },
          { name: 'more', label: 'More actions' },
        ]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'start') onStart(task.id);
          if (event.nativeEvent.actionName === 'blocker') openBlocker();
          if (event.nativeEvent.actionName === 'more') openActions();
        }}
        onPress={openTask}
        onLongPress={openActions}
        delayLongPress={350}
        pressedScale={0.985}
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
      >
        <TaskContextLine task={task} />
        <AppText variant="titleMd" numberOfLines={2}>
          {task.title}
        </AppText>
        <AppText variant="bodySm" tone="secondary" numberOfLines={2}>
          {item.headline}
        </AppText>
        <TaskFacts task={task} today={today} />
      </PressableScale>
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.lg,
    borderWidth: HAIRLINE,
    padding: SPACE.lg,
    gap: SPACE.sm,
  },
  rightActions: { flexDirection: 'row' },
});
