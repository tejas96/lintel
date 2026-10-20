'use client';

import { animate } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { DURATION } from '../../tokens/motion';
import { useCalmMotion } from './motion-preference';
import { easing } from './presets';

/**
 * Animates a number from what is on screen to `target` (the first render
 * counts up from zero). Under calm motion the number simply appears.
 */
export function useCountUp(target: number, durationMs: number = DURATION.data): number {
  const calm = useCalmMotion();
  const [display, setDisplay] = useState(calm ? target : 0);
  const shown = useRef(calm ? target : 0);

  useEffect(() => {
    if (calm) {
      shown.current = target;
      setDisplay(target);
      return;
    }
    const controls = animate(shown.current, target, {
      duration: durationMs / 1000,
      ease: easing('outExpo'),
      onUpdate: (latest) => {
        shown.current = latest;
        setDisplay(latest);
      },
    });
    return () => controls.stop();
  }, [target, calm, durationMs]);

  return display;
}
