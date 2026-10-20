import { DURATION, EASING, SPRING, STAGGER } from '@lintel/design-system/tokens';
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  ReduceMotion,
  type WithSpringConfig,
  type WithTimingConfig,
} from 'react-native-reanimated';

type EasingName = keyof typeof EASING;
type DurationName = keyof typeof DURATION;
type SpringName = keyof typeof SPRING;

function bezier(name: EasingName) {
  const [x1, y1, x2, y2] = EASING[name];
  return Easing.bezier(x1, y1, x2, y2);
}

/** Timing config from the motion tokens; follows the system reduce-motion setting. */
export function timing(duration: DurationName, easing: EasingName = 'standard'): WithTimingConfig {
  return {
    duration: DURATION[duration],
    easing: bezier(easing),
    reduceMotion: ReduceMotion.System,
  };
}

export function spring(name: SpringName): WithSpringConfig {
  return { ...SPRING[name], mass: 1, reduceMotion: ReduceMotion.System };
}

/** List entrance: a small rise with a capped stagger, so long lists never feel slow. */
export function listEntrance(index: number) {
  const step = Math.min(index, STAGGER.maxItems);
  return FadeInDown.duration(DURATION.base)
    .delay(step * STAGGER.stepMs)
    .easing(bezier('outQuint'))
    .withInitialValues({ transform: [{ translateY: STAGGER.riseOffsetPx }] })
    .reduceMotion(ReduceMotion.System);
}

export const fadeIn = FadeIn.duration(DURATION.fade).reduceMotion(ReduceMotion.System);
export const fadeOut = FadeOut.duration(DURATION.fade).reduceMotion(ReduceMotion.System);
export const layoutTransition = LinearTransition.springify()
  .stiffness(SPRING.layout.stiffness)
  .damping(SPRING.layout.damping)
  .reduceMotion(ReduceMotion.System);

/** Live value of the system "Reduce Motion" setting. */
export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  return reduceMotion;
}

export { DURATION };
