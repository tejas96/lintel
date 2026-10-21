import type { NotificationItem } from '@lintel/api-contracts';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/app-text';
import { Icon, type IconName } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { formatRelativeInstant } from '@/formatting/dates';
import { useAppTheme } from '@/theme/app-theme';
import { HAIRLINE, RADIUS, SPACE } from '@/theme/layout';

const KIND_ICON: Readonly<Record<NotificationItem['kind'], IconName>> = {
  task_assigned: 'add',
  task_reassigned: 'person',
  deadline_upcoming: 'calendar',
  task_overdue: 'waiting',
  task_overdue_escalated: 'waiting',
  task_blocked: 'blocked',
  blocker_resolved: 'done',
  review_requested: 'review',
  review_reminder: 'review',
  review_decided: 'approvals',
  leave_requested: 'leave',
  leave_decided: 'leave',
  leave_info_requested: 'info',
  handover_requested: 'person',
  absence_reassessment: 'error',
  project_at_risk: 'error',
  scope_change_requested: 'projects',
  scope_change_decided: 'projects',
  reward_updated: 'flag',
  reward_review_requested: 'approvals',
  priority_changed: 'flag',
  reassignment_requested: 'person',
  reassignment_decided: 'person',
};

export interface NotificationRowProps {
  readonly notification: NotificationItem;
  readonly opensScreen: boolean;
  readonly onPress: (notification: NotificationItem) => void;
}

/** Unread items carry the accent dot ("new"); read ones step back. */
export function NotificationRow({ notification, opensScreen, onPress }: NotificationRowProps) {
  const { colors } = useAppTheme();
  const unread = notification.readAt === null;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${unread ? 'Unread. ' : ''}${notification.title}. ${notification.body}`}
      {...(opensScreen ? { accessibilityHint: 'Opens the related item' } : {})}
      onPress={() => onPress(notification)}
      pressedScale={0.985}
      style={[
        styles.row,
        {
          backgroundColor: unread ? colors.surfaceRaised : colors.surface,
          borderColor: colors.borderSubtle,
        },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: colors.surfaceSunken }]}>
        <Icon name={KIND_ICON[notification.kind]} size={18} color={colors.textSecondary} />
      </View>
      <View style={styles.text}>
        <View style={styles.titleRow}>
          <AppText variant={unread ? 'titleMd' : 'body'} style={styles.flex} numberOfLines={2}>
            {notification.title}
          </AppText>
          {unread ? <View style={[styles.dot, { backgroundColor: colors.accent }]} /> : null}
        </View>
        <AppText variant="bodySm" tone="secondary" numberOfLines={3}>
          {notification.body}
        </AppText>
        <AppText variant="mono" tone="tertiary">
          {formatRelativeInstant(notification.createdAt)}
        </AppText>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: SPACE.md,
    padding: SPACE.lg,
    borderRadius: RADIUS.lg,
    borderWidth: HAIRLINE,
  },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm },
  flex: { flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 8 },
});
