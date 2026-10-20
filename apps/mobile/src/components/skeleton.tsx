import { createContext, type ReactNode, use, useEffect } from 'react';
import { type DimensionValue, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useAppTheme } from '@/theme/app-theme';
import { RADIUS, SPACE } from '@/theme/layout';
import { timing, useReduceMotion } from '@/theme/motion';

const PulseContext = createContext<SharedValue<number> | null>(null);

/**
 * Placeholder blocks that breathe together. This is the app's only looping
 * animation; with Reduce Motion on, the blocks stay still.
 */
export function SkeletonGroup({
  children,
  label = 'Loading',
}: {
  readonly children: ReactNode;
  readonly label?: string;
}) {
  const pulse = useSharedValue(0);
  const reduceMotion = useReduceMotion();
  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(pulse);
      pulse.set(0);
      return;
    }
    pulse.set(withRepeat(withTiming(1, timing('ambient', 'inOut')), -1, true));
    return () => cancelAnimation(pulse);
  }, [pulse, reduceMotion]);
  return (
    <View accessible accessibilityLabel={label} accessibilityRole="progressbar">
      <PulseContext value={pulse}>{children}</PulseContext>
    </View>
  );
}

export interface SkeletonBlockProps {
  readonly width?: DimensionValue;
  readonly height: number;
  readonly radius?: number;
}

export function SkeletonBlock({ width = '100%', height, radius = RADIUS.sm }: SkeletonBlockProps) {
  const { colors } = useAppTheme();
  const pulse = use(PulseContext);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: pulse ? 1 - pulse.get() * 0.45 : 1,
  }));
  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: colors.surfaceSunken },
        animatedStyle,
      ]}
    />
  );
}

/** A card-shaped placeholder that matches list rows across the app. */
export function SkeletonRow() {
  const { colors } = useAppTheme();
  return (
    <View
      style={[styles.row, { borderColor: colors.borderSubtle, backgroundColor: colors.surface }]}
    >
      <SkeletonBlock width="35%" height={10} />
      <SkeletonBlock width="80%" height={16} />
      <View style={styles.inline}>
        <SkeletonBlock width={72} height={20} radius={RADIUS.full} />
        <SkeletonBlock width={96} height={20} radius={RADIUS.full} />
      </View>
    </View>
  );
}

export function SkeletonList({
  count = 4,
  label,
}: {
  readonly count?: number;
  readonly label?: string;
}) {
  return (
    <SkeletonGroup {...(label ? { label } : {})}>
      <View style={styles.list}>
        {placeholderSlots(count).map((slot) => (
          <SkeletonRow key={slot} />
        ))}
      </View>
    </SkeletonGroup>
  );
}

/** Stable keys for placeholder rows (their position is their identity). */
function placeholderSlots(count: number): string[] {
  return Array.from({ length: count }, (_, position) => `placeholder-${position + 1}`);
}

const styles = StyleSheet.create({
  row: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACE.lg, gap: SPACE.sm },
  inline: { flexDirection: 'row', gap: SPACE.sm },
  list: { gap: SPACE.md },
});
