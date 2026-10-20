import type { TaskDetail, TransitionOption } from '@lintel/api-contracts';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/app-text';
import { Button, type ButtonVariant } from '@/components/button';
import { Icon } from '@/components/icon';
import { Section } from '@/components/section';
import { useAppTheme } from '@/theme/app-theme';
import { RADIUS, SPACE } from '@/theme/layout';
import { useRunTransition } from './use-run-transition';

const FORWARD = new Set<TransitionOption['to']>(['in_progress', 'in_review', 'done']);

function variantFor(option: TransitionOption, isFirstForward: boolean): ButtonVariant {
  if (option.to === 'cancelled') return 'danger';
  return isFirstForward ? 'primary' : 'secondary';
}

/**
 * Status changes come from the server's `transitions`: allowed ones are
 * buttons, and refused ones are listed with the server's reasons.
 */
export function TaskStatusActions({ task }: { readonly task: TaskDetail }) {
  const { colors } = useAppTheme();
  const { run, pendingTo } = useRunTransition(task);
  const allowed = task.transitions.filter((option) => option.allowed);
  const refused = task.transitions.filter((option) => !option.allowed && option.reasons.length > 0);
  if (task.transitions.length === 0) return null;
  const firstForward = allowed.find((option) => FORWARD.has(option.to))?.to;

  return (
    <Section title="Move this task">
      {allowed.length > 0 ? (
        <View style={styles.buttons}>
          {allowed.map((option) => (
            <Button
              key={option.to}
              label={option.label}
              variant={variantFor(option, option.to === firstForward)}
              loading={pendingTo === option.to}
              disabled={pendingTo !== undefined && pendingTo !== option.to}
              onPress={() => run(option)}
              {...(option.requiresNote ? { accessibilityHint: 'Asks for a short note first' } : {})}
            />
          ))}
        </View>
      ) : (
        <AppText variant="bodySm" tone="secondary">
          There’s nothing you can change on this task right now.
        </AppText>
      )}
      {refused.map((option) => (
        <View
          key={option.to}
          style={[styles.refused, { backgroundColor: colors.surfaceSunken }]}
          accessible
          accessibilityLabel={`${option.label} is not available: ${option.reasons.join('. ')}`}
        >
          <Icon name="lock" size={14} color={colors.textSecondary} />
          <View style={styles.refusedText}>
            <AppText variant="label" tone="secondary">
              {option.label}
            </AppText>
            {option.reasons.map((reason) => (
              <AppText key={reason} variant="bodySm" tone="secondary">
                {reason}
              </AppText>
            ))}
          </View>
        </View>
      ))}
    </Section>
  );
}

const styles = StyleSheet.create({
  buttons: { gap: SPACE.sm },
  refused: {
    flexDirection: 'row',
    gap: SPACE.sm,
    padding: SPACE.md,
    borderRadius: RADIUS.md,
    alignItems: 'flex-start',
  },
  refusedText: { flex: 1, gap: 2 },
});
