import type { NotificationPreferences } from '@lintel/api-contracts';
import { StyleSheet, Switch, View } from 'react-native';
import { errorMessage, isNotFound } from '@/api/api-error';
import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/icon-button';
import { InlineError } from '@/components/state-views';
import { useToast } from '@/feedback/toast';
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from '@/queries/notification-queries';
import { useAppTheme } from '@/theme/app-theme';
import { SPACE, TOUCH_TARGET } from '@/theme/layout';

const STEP_MINUTES = 30;
const DEFAULT_QUIET = { start: '21:00', end: '08:00' } as const;

function shiftTime(time: string, minutes: number): string {
  const [hours = 0, mins = 0] = time.split(':').map(Number);
  const total = (((hours * 60 + mins + minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function TimeStepper({
  label,
  value,
  onChange,
  disabled,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (time: string) => void;
  readonly disabled: boolean;
}) {
  return (
    <View style={styles.stepper} accessible={false}>
      <AppText variant="bodySm" tone="secondary" style={styles.stepperLabel}>
        {label}
      </AppText>
      <IconButton
        icon="back"
        accessibilityLabel={`${label} 30 minutes earlier`}
        onPress={() => onChange(shiftTime(value, -STEP_MINUTES))}
        disabled={disabled}
      />
      <AppText variant="titleMd" style={styles.time} accessibilityLabel={`${label} ${value}`}>
        {value}
      </AppText>
      <IconButton
        icon="chevronRight"
        accessibilityLabel={`${label} 30 minutes later`}
        onPress={() => onChange(shiftTime(value, STEP_MINUTES))}
        disabled={disabled}
      />
    </View>
  );
}

/** Quiet hours: pushes wait until the end of the window (the server enforces it). */
export function QuietHours() {
  const toast = useToast();
  const { colors } = useAppTheme();
  const preferences = useNotificationPreferences();
  const update = useUpdateNotificationPreferences();
  if (preferences.isError) {
    if (isNotFound(preferences.error)) return null;
    return <InlineError error={preferences.error} onRetry={() => void preferences.refetch()} />;
  }
  if (!preferences.data) return null;
  const current = preferences.data;
  const save = (quietHours: NotificationPreferences['quietHours']) =>
    update.mutate(
      { ...current, quietHours },
      { onError: (error) => toast.show(errorMessage(error), 'error') },
    );
  const quiet = current.quietHours;
  return (
    <View style={styles.block}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <AppText variant="body">Quiet hours</AppText>
          <AppText variant="bodySm" tone="secondary">
            {quiet
              ? `No pushes ${quiet.start}–${quiet.end}; they arrive after.`
              : 'Pushes can arrive any time.'}
          </AppText>
        </View>
        <Switch
          value={quiet !== null}
          onValueChange={(on) => save(on ? DEFAULT_QUIET : null)}
          disabled={update.isPending}
          trackColor={{ true: colors.accent, false: colors.borderStrong }}
          accessibilityLabel="Quiet hours"
        />
      </View>
      {quiet ? (
        <>
          <TimeStepper
            label="From"
            value={quiet.start}
            onChange={(start) => save({ ...quiet, start })}
            disabled={update.isPending}
          />
          <TimeStepper
            label="Until"
            value={quiet.end}
            onChange={(end) => save({ ...quiet, end })}
            disabled={update.isPending}
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: SPACE.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, minHeight: TOUCH_TARGET },
  flex: { flex: 1, gap: 2 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  stepperLabel: { width: 52 },
  time: { minWidth: 64, textAlign: 'center', fontVariant: ['tabular-nums'] },
});
