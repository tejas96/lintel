import { MIN_TOUCH_TARGET, RADIUS, SPACING } from '@lintel/design-system/tokens';

/** Named steps of the 4 px spacing scale. */
export const SPACE = {
  hairline: SPACING[1],
  xs: SPACING[2],
  sm: SPACING[3],
  md: SPACING[4],
  lg: SPACING[5],
  xl: SPACING[6],
  xxl: SPACING[7],
  xxxl: SPACING[8],
  huge: SPACING[9],
} as const;

export { RADIUS };

/** Every tappable element is at least this tall and wide (points). */
export const TOUCH_TARGET = MIN_TOUCH_TARGET;

/** Horizontal page gutter and the readable content width on tablets. */
export const GUTTER = SPACE.xl;
export const MAX_CONTENT_WIDTH = 680;

/** Thin rules: the design language is paper with hairline borders. */
export const HAIRLINE = 1;
