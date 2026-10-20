import type { ThemeColors } from '../tokens/colors';

/**
 * Tailwind colour names for each theme token, chosen to read well in class
 * names (`bg-canvas text-ink border-hairline`). Typed against ThemeColors so a
 * new token cannot be added without a CSS name.
 */
export const COLOR_CSS_NAMES: Readonly<Record<keyof ThemeColors, string>> = {
  canvas: 'canvas',
  surface: 'surface',
  surfaceRaised: 'raised',
  surfaceSunken: 'sunken',
  borderSubtle: 'hairline',
  borderStrong: 'rule',
  textPrimary: 'ink',
  textSecondary: 'ink-muted',
  textTertiary: 'ink-faint',
  accent: 'accent',
  accentHover: 'accent-hover',
  accentPressed: 'accent-pressed',
  onAccent: 'on-accent',
  accentSoft: 'accent-soft',
  onAccentSoft: 'on-accent-soft',
  clay: 'clay',
  claySoft: 'clay-soft',
  sage: 'sage',
  sageSoft: 'sage-soft',
  focusRing: 'focus',
  scrim: 'scrim',
  blueprint: 'blueprint',
  onBlueprint: 'on-blueprint',
  onBlueprintMuted: 'on-blueprint-muted',
  blueprintLine: 'blueprint-line',
};

/** camelCase → kebab-case (`onTrack` → `on-track`, `displayXl` → `display-xl`). */
export function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

export function px(value: number): string {
  return `${value}px`;
}

/** px → rem so text follows the reader's browser font size. */
export function rem(value: number): string {
  return `${Number((value / 16).toFixed(4))}rem`;
}

export function cubicBezier(points: readonly number[]): string {
  return `cubic-bezier(${points.join(', ')})`;
}

export function block(selector: string, declarations: readonly string[], indent = ''): string {
  const body = declarations.map((line) => `${indent}  ${line}`).join('\n');
  return `${indent}${selector} {\n${body}\n${indent}}`;
}
