import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { errorMessage, isNotFound, NetworkError } from '@/api/api-error';
import { useAppTheme } from '@/theme/app-theme';
import { RADIUS, SPACE } from '@/theme/layout';
import { fadeIn } from '@/theme/motion';
import { AppText } from './app-text';
import { Button } from './button';
import { Icon, type IconName } from './icon';

export interface EmptyStateProps {
  readonly icon: IconName;
  readonly title: string;
  readonly message: string;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
}

/** Calm, specific and honest: what is empty, why, and what to do next. */
export function EmptyState({ icon, title, message, actionLabel, onAction }: EmptyStateProps) {
  const { colors } = useAppTheme();
  return (
    <Animated.View entering={fadeIn} style={styles.container}>
      <View style={[styles.badge, { backgroundColor: colors.surfaceSunken }]}>
        <Icon name={icon} size={24} color={colors.textSecondary} />
      </View>
      <AppText variant="titleMd" align="center">
        {title}
      </AppText>
      <AppText variant="bodySm" tone="secondary" align="center" style={styles.message}>
        {message}
      </AppText>
      {actionLabel && onAction ? (
        <Button label={actionLabel} variant="secondary" onPress={onAction} />
      ) : null}
    </Animated.View>
  );
}

export interface ErrorStateProps {
  readonly error: unknown;
  readonly onRetry: () => void;
  /** What could not be loaded, e.g. "your work queue". */
  readonly subject: string;
}

export function ErrorState({ error, onRetry, subject }: ErrorStateProps) {
  if (isNotFound(error)) {
    return (
      <EmptyState
        icon="info"
        title="Not available"
        message={`We couldn’t find ${subject}. It may have been removed, you may no longer have access, or your studio’s server doesn’t offer it yet.`}
        actionLabel="Check again"
        onAction={onRetry}
      />
    );
  }
  const offline = error instanceof NetworkError;
  return (
    <EmptyState
      icon={offline ? 'offline' : 'error'}
      title={offline ? 'You’re offline' : `Couldn’t load ${subject}`}
      message={errorMessage(error)}
      actionLabel="Try again"
      onAction={onRetry}
    />
  );
}

/** A compact inline error for sections inside a screen. */
export function InlineError({
  error,
  onRetry,
}: {
  readonly error: unknown;
  readonly onRetry?: () => void;
}) {
  const { status } = useAppTheme();
  return (
    <View
      style={[styles.inline, { backgroundColor: status.overdue.tint }]}
      accessibilityRole="alert"
    >
      <Icon name="error" size={16} color={status.overdue.fg} />
      <AppText variant="bodySm" color={status.overdue.fg} style={styles.inlineText}>
        {errorMessage(error)}
      </AppText>
      {onRetry ? <Button label="Retry" variant="quiet" onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: SPACE.sm,
    paddingVertical: SPACE.huge,
    paddingHorizontal: SPACE.xl,
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACE.sm,
  },
  message: { maxWidth: 320, marginBottom: SPACE.md },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    paddingLeft: SPACE.md,
    borderRadius: RADIUS.md,
    minHeight: 44,
  },
  inlineText: { flex: 1, paddingVertical: SPACE.sm },
});
