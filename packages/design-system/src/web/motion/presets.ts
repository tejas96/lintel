import type { Transition } from 'motion/react';
import { DURATION, EASING, SPRING, STAGGER } from '../../tokens/motion';

/** Token easing as a mutable tuple, the shape Motion expects. */
export function easing(name: keyof typeof EASING): [number, number, number, number] {
  const [a, b, c, d] = EASING[name];
  return [a, b, c, d];
}

export function seconds(name: keyof typeof DURATION): number {
  return DURATION[name] / 1000;
}

/** A page or panel arriving: a short rise and fade. */
export const pageEnter = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: seconds('slow'), ease: easing('outQuint') },
} as const;

/** Content swapping in place (tabs, steps): fade with a hint of direction. */
export function swapEnter(direction: 1 | -1 = 1) {
  return {
    initial: { opacity: 0, x: 12 * direction },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -12 * direction },
    transition: { duration: seconds('base'), ease: easing('standard') },
  } as const;
}

/**
 * Staggered list entrance. Only the first STAGGER.maxItems rise; the rest
 * appear at once so long lists never feel slow.
 */
export function listItemEnter(index: number) {
  if (index >= STAGGER.maxItems) return { initial: false as const };
  return {
    initial: { opacity: 0, y: STAGGER.riseOffsetPx },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: seconds('slow'),
      ease: easing('outQuint'),
      delay: (index * STAGGER.stepMs) / 1000,
    },
  };
}

export const layoutSpring: Transition = { type: 'spring', ...SPRING.layout };
export const snappySpring: Transition = { type: 'spring', ...SPRING.snappy };
export const gentleSpring: Transition = { type: 'spring', ...SPRING.gentle };

/** Data visuals (rings, bars, count-ups) settle with a long ease-out. */
export const dataTransition: Transition = { duration: seconds('data'), ease: easing('outExpo') };

/** A card picked up to drag. */
export const dragLift = { scale: 1.025, rotate: -0.8 } as const;

/** Overlays: sheets slide from their edge, dialogs scale up from 98%. */
export const sheetTransition: Transition = { type: 'spring', ...SPRING.layout };
export const dialogEnter = {
  initial: { opacity: 0, scale: 0.98, y: 6 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.98, y: 4 },
  transition: { duration: seconds('base'), ease: easing('outQuint') },
} as const;
