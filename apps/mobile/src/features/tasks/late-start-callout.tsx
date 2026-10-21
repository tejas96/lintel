import type { TaskDateChanges, TaskDetail } from '@lintel/api-contracts';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { errorMessage } from '@/api/api-error';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { HighlightRing } from '@/components/highlight-ring';
import { Icon } from '@/components/icon';
import { useToast } from '@/feedback/toast';
import { formatDayMonth } from '@/formatting/dates';
import { useStartTask, useStartWork } from '@/queries/work-queries';
import { useCurrentUser } from '@/session/session-provider';
import { useAppTheme } from '@/theme/app-theme';
import { RADIUS, SPACE } from '@/theme/layout';
import { fadeOut, listEntrance } from '@/theme/motion';
import { canReportBlocker } from './task-affordances';

/** The move to In progress when it can be made in one tap: allowed and without a note. */
function oneTapStart(task: TaskDetail) {
  const move = task.transitions.find((option) => option.to === 'in_progress');
  return move?.allowed && !move.requiresNote ? move : null;
}

/**
 * Shown while a task that could start now has passed its planned start
 * (Ready, start before today, the server allows the move to In progress), and
 * ringed in the accent when the late-start nudge brought the person here:
 * start it, report what is in the way, or ask for a new date. Every button is
 * one the server already allows.
 */
export function LateStartCallout({
  task,
  today,
  changes,
  nudged,
}: {
  readonly task: TaskDetail;
  readonly today: string;
  readonly changes: TaskDateChanges | undefined;
  readonly nudged: boolean;
}) {
  const router = useRouter();
  const user = useCurrentUser();
  const toast = useToast();
  const { status } = useAppTheme();
  const startWork = useStartWork();
  const startTask = useStartTask();
  const planned = task.plannedStartDate;
  if (task.status !== 'ready' || !planned || planned >= today || !oneTapStart(task)) return null;
  const canBlock = canReportBlocker(task, user.id);
  const canAsk = changes?.viewerCanRequest ?? false;
  const askedFor = changes?.requests.find((request) => request.status === 'open');
  const handlers = {
    onSuccess: () => toast.show('Work started.', 'success'),
    onError: (error: unknown) => toast.show(errorMessage(error), 'error'),
  };
  const begin = () =>
    task.workTrackingEnabled
      ? startWork.mutate(task.id, handlers)
      : startTask.mutate({ taskId: task.id, version: task.version }, handlers);

  return (
    <Animated.View entering={listEntrance(0)} exiting={fadeOut}>
      <HighlightRing active={nudged}>
        <View
          style={[
            styles.callout,
            { backgroundColor: status.atRisk.tint, borderColor: `${status.atRisk.solid}4D` },
          ]}
        >
          <View style={styles.titleRow}>
            <Icon name="error" size={18} color={status.atRisk.fg} weight="medium" />
            <AppText variant="titleMd" style={styles.flex} accessibilityRole="header">
              Planned to start {formatDayMonth(planned)}, not started yet
            </AppText>
          </View>
          <AppText variant="bodySm" tone="secondary">
            {askedFor
              ? `You asked for a new due date (${formatDayMonth(askedFor.proposedDueDate)}); the project manager has not decided yet. Start now if you can.`
              : 'Start it now, say what is in the way, or ask the project manager for a new date.'}
          </AppText>
          <View style={styles.buttons}>
            <Button
              label="Start now"
              icon="play"
              loading={startWork.isPending || startTask.isPending}
              onPress={begin}
            />
            {canBlock ? (
              <Button
                label="Report a blocker"
                icon="blocked"
                variant="secondary"
                onPress={() =>
                  router.push({ pathname: '/tasks/[id]/blocker', params: { id: task.id } })
                }
              />
            ) : null}
            {canAsk ? (
              <Button
                label="Ask for a new date"
                icon="calendar"
                variant="secondary"
                onPress={() =>
                  router.push({ pathname: '/tasks/[id]/new-date', params: { id: task.id } })
                }
              />
            ) : null}
          </View>
        </View>
      </HighlightRing>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  callout: { borderRadius: RADIUS.lg, borderWidth: 1, padding: SPACE.lg, gap: SPACE.sm },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm },
  flex: { flex: 1 },
  buttons: { gap: SPACE.sm, marginTop: SPACE.sm },
});
