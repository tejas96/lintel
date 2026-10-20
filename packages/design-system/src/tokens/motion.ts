/** Durations in ms. Under reduced motion, everything except `fade` collapses to ~0. */
export const DURATION = {
  instant: 80,
  fast: 140,
  base: 220,
  slow: 320,
  data: 850,
  ambient: 1400,
  fade: 120,
} as const;

/** Cubic-bezier control points. */
export const EASING = {
  standard: [0.2, 0, 0, 1],
  outExpo: [0.16, 1, 0.3, 1],
  outQuint: [0.22, 1, 0.36, 1],
  in: [0.4, 0, 1, 1],
  inOut: [0.65, 0, 0.35, 1],
} as const;

/** Spring presets shared by Motion (web) and Reanimated (mobile). */
export const SPRING = {
  snappy: { stiffness: 500, damping: 40 },
  layout: { stiffness: 380, damping: 32 },
  gentle: { stiffness: 170, damping: 26 },
} as const;

/** List entrance stagger: per-item delay and the cap on animated items. */
export const STAGGER = { stepMs: 30, maxItems: 8, riseOffsetPx: 6 } as const;
