import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { spring } from '@/theme/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, 'style' | 'children'> {
  readonly children: ReactNode;
  readonly style?: StyleProp<ViewStyle>;
  /** How far the surface sinks while pressed (1 = no movement). */
  readonly pressedScale?: number;
}

/**
 * The single press affordance: the surface sinks slightly under the finger and
 * springs back, which reads as physical without being decorative.
 */
export function PressableScale({
  children,
  style,
  pressedScale = 0.97,
  onPressIn,
  onPressOut,
  disabled,
  ...props
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      accessibilityState={{ disabled: Boolean(disabled), ...props.accessibilityState }}
      onPressIn={(event) => {
        scale.set(withSpring(pressedScale, spring('snappy')));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.set(withSpring(1, spring('snappy')));
        onPressOut?.(event);
      }}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}
