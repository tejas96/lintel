import { TYPE_SCALE, type TypeStyle } from '@lintel/design-system/tokens';
import type { TextStyle } from 'react-native';
import { fontFaceFor } from './fonts';

export const TEXT_VARIANTS = [
  'displayXl',
  'displayLg',
  'displayMd',
  'titleLg',
  'titleMd',
  'body',
  'bodySm',
  'label',
  'overline',
  'mono',
] as const;

export type TextVariant = (typeof TEXT_VARIANTS)[number];

/** Token tracking is in em ("-0.02em"); React Native wants points. */
function letterSpacingFor(tracking: string, size: number): number {
  const value = Number.parseFloat(tracking);
  if (!Number.isFinite(value)) return 0;
  return tracking.endsWith('em') ? Math.round(value * size * 100) / 100 : value;
}

function toTextStyle(variant: TextVariant, style: TypeStyle | undefined): TextStyle {
  if (!style) throw new Error(`Type token "${variant}" is missing from the design system.`);
  return {
    fontFamily: fontFaceFor(style.family, style.weight),
    fontSize: style.size,
    lineHeight: style.lineHeight,
    letterSpacing: letterSpacingFor(style.tracking, style.size),
    ...(variant === 'overline' ? { textTransform: 'uppercase' as const } : {}),
    ...(variant === 'mono' || style.family === 'display'
      ? { fontVariant: ['tabular-nums' as const] }
      : {}),
  };
}

export const TEXT_STYLES: Readonly<Record<TextVariant, TextStyle>> = {
  displayXl: toTextStyle('displayXl', TYPE_SCALE.displayXl),
  displayLg: toTextStyle('displayLg', TYPE_SCALE.displayLg),
  displayMd: toTextStyle('displayMd', TYPE_SCALE.displayMd),
  titleLg: toTextStyle('titleLg', TYPE_SCALE.titleLg),
  titleMd: toTextStyle('titleMd', TYPE_SCALE.titleMd),
  body: toTextStyle('body', TYPE_SCALE.body),
  bodySm: toTextStyle('bodySm', TYPE_SCALE.bodySm),
  label: toTextStyle('label', TYPE_SCALE.label),
  overline: toTextStyle('overline', TYPE_SCALE.overline),
  mono: toTextStyle('mono', TYPE_SCALE.mono),
};

/** Large display sizes stop growing early so headlines never wrap into chaos. */
export const MAX_FONT_SCALE: Readonly<Record<TextVariant, number>> = {
  displayXl: 1.15,
  displayLg: 1.2,
  displayMd: 1.3,
  titleLg: 1.5,
  titleMd: 1.6,
  body: 1.8,
  bodySm: 1.8,
  label: 1.6,
  overline: 1.4,
  mono: 1.6,
};

export const ITALIC_DISPLAY_FACE = fontFaceFor('display', 400, true);
