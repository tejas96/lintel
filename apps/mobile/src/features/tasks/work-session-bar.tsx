import type { TaskDetail } from '@lintel/api-contracts';
import { StyleSheet, View } from 'react-native';
import { errorMessage } from '@/api/api-error';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { useElapsedSeconds } from '@/features/today/use-elapsed-seconds';
import { useToast } from '@/feedback/toast';
import { formatElapsed, formatMinutes } from '@/formatting/quantities';
import { usePauseWork, useStartWork } from '@/queries/work-queries';
import { useCurrentUser } from '@/session/session-provider';
import { useAppTheme } from '@/theme/app-theme';
import { SPACE } from '@/theme/layout';
import { canBeginWork } from './task-affordances';

function SessionControl({ task, active }: { readonly task: TaskDetail; readonly active: boolean }) {
  const user = useCurrentUser();
  const toast = useToast();
  const startWork = useStartWork();
  const pauseWork = usePauseWork();
  const onError = (error: unknown) => toast.show(errorMessage(error), 'error');
  if (active) {
    return (
      <Button
        label="Pause"
        icon="pause"
        variant="secondary"
        loading={pauseWork.isPending}
        onPress={() =>
          pauseWork.mutate(task.id, {
            onSuccess: () => toast.show('Paused. Your time is saved.', 'success'),
            onError,
          })
        }
      />
    );
  }
  if (!canBeginWork(task, user.id)) return null;
  return (
    <Button
      label="Start"
      icon="play"
      loading={startWork.isPending}
      onPress={() =>
        startWork.mutate(task.id, {
          onSuccess: () => toast.show('Work started.', 'success'),
          onError,
        })
      }
    />
  );
}

/** Start or pause a work session; the server keeps one active session per person. */
export function WorkSessionBar({ task }: { readonly task: TaskDetail }) {
  const user = useCurrentUser();
  const { colors } = useAppTheme();
  const elapsed = useElapsedSeconds(task.activeWorkSessionStartedAt);
  const active = task.activeWorkSessionStartedAt !== null;
  const logged = task.actualMinutes > 0 ? `${formatMinutes(task.actualMinutes)} logged` : null;
  if (!active && !canBeginWork(task, user.id) && !logged) return null;
  const estimate = task.estimateMinutes
    ? `of ${formatMinutes(task.estimateMinutes)} estimated`
    : null;
  const detail = [active ? logged : null, estimate].filter(Boolean).join(' ');
  const strong = active ? colors.onAccentSoft : colors.textPrimary;

  return (
    <Card tone={active ? 'accentSoft' : 'surface'} style={styles.card}>
      <View style={styles.text}>
        <AppText variant="overline" color={active ? colors.onAccentSoft : colors.textSecondary}>
          {active ? 'Working now' : 'Work session'}
        </AppText>
        <AppText variant="titleLg" color={strong} style={styles.timer}>
          {elapsed !== null ? formatElapsed(elapsed) : (logged ?? 'No time logged yet')}
        </AppText>
        {detail ? (
          <AppText variant="bodySm" tone="secondary">
            {detail}
          </AppText>
        ) : null}
      </View>
      <SessionControl task={task} active={active} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  text: { flex: 1, gap: 2 },
  timer: { fontVariant: ['tabular-nums'] },
});
