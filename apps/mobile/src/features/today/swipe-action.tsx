import { StyleSheet } from 'react-native';
import Animated, { interpolate, type SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { AppText } from '@/components/app-text';
import { Icon, type IconName } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { RADIUS, SPACE } from '@/theme/layout';

export interface SwipeActionProps {
  readonly label: string;
  readonly icon: IconName;
  readonly background: string;
  readonly foreground: string;
  readonly progress: SharedValue<number>;
  readonly onPress: () => void;
}

/** An action revealed by swiping a row; it grows into place as the row slides. */
export function SwipeAction({
  label,
  icon,
  background,
  foreground,
  progress,
  onPress,
}: SwipeActionProps) {
  const revealStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0, 0.6, 1], [0, 0.6, 1], 'clamp'),
    transform: [{ scale: interpolate(progress.get(), [0, 1], [0.86, 1], 'clamp') }],
  }));
  return (
    <Animated.View style={[styles.slot, revealStyle]}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={[styles.action, { backgroundColor: background }]}
      >
        <Icon name={icon} size={20} color={foreground} weight="semibold" />
        <AppText variant="label" color={foreground}>
          {label}
        </AppText>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  slot: { width: 84, paddingHorizontal: SPACE.xs },
  action: {
    flex: 1,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.xs,
  },
});
