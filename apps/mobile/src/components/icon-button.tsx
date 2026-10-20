import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '@/theme/app-theme';
import { RADIUS, TOUCH_TARGET } from '@/theme/layout';
import { AppText } from './app-text';
import { Icon, type IconName } from './icon';
import { PressableScale } from './pressable-scale';

export interface IconButtonProps {
  readonly icon: IconName;
  /** Required: icon-only controls must say what they do. */
  readonly accessibilityLabel: string;
  readonly onPress: () => void;
  readonly tone?: 'plain' | 'filled';
  readonly badgeCount?: number;
  readonly disabled?: boolean;
}

export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  tone = 'plain',
  badgeCount = 0,
  disabled = false,
}: IconButtonProps) {
  const { colors, status } = useAppTheme();
  const filled = tone === 'filled';
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={
        badgeCount > 0 ? `${accessibilityLabel}, ${badgeCount} unread` : accessibilityLabel
      }
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      pressedScale={0.92}
      style={[
        styles.base,
        filled
          ? { backgroundColor: colors.surfaceRaised, borderColor: colors.borderSubtle }
          : { borderColor: 'transparent' },
        disabled ? styles.disabled : null,
      ]}
    >
      <Icon name={icon} size={22} color={colors.textPrimary} />
      {badgeCount > 0 ? (
        <View style={[styles.badge, { backgroundColor: status.overdue.solid }]}>
          <AppText variant="label" color={colors.surfaceRaised} style={styles.badgeText}>
            {badgeCount > 99 ? '99+' : String(badgeCount)}
          </AppText>
        </View>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
  badge: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 11, lineHeight: 14 },
});
