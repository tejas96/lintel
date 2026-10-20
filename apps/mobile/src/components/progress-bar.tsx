import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useAppTheme } from '@/theme/app-theme';
import { RADIUS } from '@/theme/layout';
import { timing } from '@/theme/motion';

export interface ProgressBarProps {
  /** 0…1 */
  readonly value: number;
  readonly color?: string | undefined;
  readonly height?: number;
  readonly accessibilityLabel: string;
}

/** Draws on from where it was, so progress reads as movement, not a jump. */
export function ProgressBar({ value, color, height = 6, accessibilityLabel }: ProgressBarProps) {
  const { colors } = useAppTheme();
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(withTiming(clamped, timing('data', 'outExpo')));
  }, [clamped, progress]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.get() * 100}%` }));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={[styles.track, { height, backgroundColor: colors.surfaceSunken }]}
    >
      <Animated.View
        style={[styles.fill, { backgroundColor: color ?? colors.accent }, fillStyle]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', borderRadius: RADIUS.full, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: RADIUS.full },
});
