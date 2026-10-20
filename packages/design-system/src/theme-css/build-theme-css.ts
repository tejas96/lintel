import { DARK_COLORS, LIGHT_COLORS, PROJECT_SWATCHES, type ThemeColors } from '../tokens/colors';
import { BREAKPOINTS, DARK_ELEVATION, ELEVATION, RADIUS } from '../tokens/layout';
import { DURATION, EASING } from '../tokens/motion';
import { DARK_STATUS, LIGHT_STATUS, STATUS_TONES, type StatusColor } from '../tokens/status';
import { FONT_FAMILIES, TYPE_SCALE } from '../tokens/typography';
import { block, COLOR_CSS_NAMES, cubicBezier, kebab, px, rem } from './css-names';

type ThemeName = 'light' | 'dark';

const FONT_FALLBACKS: Readonly<Record<keyof typeof FONT_FAMILIES, string>> = {
  display: 'Georgia, "Times New Roman", serif',
  ui: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  mono: 'ui-monospace, "SFMono-Regular", Menlo, monospace',
};

/** CSS variable names that next/font (or any host) sets for the loaded faces. */
export const FONT_FACE_VARIABLES: Readonly<Record<keyof typeof FONT_FAMILIES, string>> = {
  display: '--font-face-display',
  ui: '--font-face-ui',
  mono: '--font-face-mono',
};

const TAILWIND_FONT_NAMES: Readonly<Record<keyof typeof FONT_FAMILIES, string>> = {
  display: 'display',
  ui: 'sans',
  mono: 'mono',
};

function fontStack(role: keyof typeof FONT_FAMILIES): string {
  return `var(${FONT_FACE_VARIABLES[role]}), "${FONT_FAMILIES[role]}", ${FONT_FALLBACKS[role]}`;
}

function colorEntries(): Array<[keyof ThemeColors, string]> {
  return Object.entries(COLOR_CSS_NAMES) as Array<[keyof ThemeColors, string]>;
}

function statusVariables(statuses: Readonly<Record<string, StatusColor>>): string[] {
  return STATUS_TONES.flatMap((tone) => {
    const color = statuses[tone];
    if (!color) return [];
    const name = kebab(tone);
    return [
      `--lt-${name}: ${color.fg};`,
      `--lt-${name}-tint: ${color.tint};`,
      `--lt-${name}-solid: ${color.solid};`,
    ];
  });
}

/** Runtime values for one theme. Only these change when the theme changes. */
function themeVariables(theme: ThemeName): string[] {
  const colors = theme === 'light' ? LIGHT_COLORS : DARK_COLORS;
  const statuses = theme === 'light' ? LIGHT_STATUS : DARK_STATUS;
  const shadows = theme === 'light' ? ELEVATION : DARK_ELEVATION;
  const swatches = PROJECT_SWATCHES[theme];
  return [
    `color-scheme: ${theme};`,
    ...colorEntries().map(([token, name]) => `--lt-${name}: ${colors[token]};`),
    ...statusVariables(statuses),
    ...swatches.map((swatch, index) => `--lt-swatch-${index}: ${swatch};`),
    ...Object.entries(shadows).map(([level, shadow]) => `--lt-shadow-${level}: ${shadow};`),
  ];
}

/** Tailwind theme entries that point at the runtime variables (`@theme inline`). */
function inlineThemeEntries(): string[] {
  const statusNames = STATUS_TONES.map(kebab).flatMap((name) => [
    name,
    `${name}-tint`,
    `${name}-solid`,
  ]);
  return [
    '--color-*: initial;',
    ...colorEntries().map(([, name]) => `--color-${name}: var(--lt-${name});`),
    ...statusNames.map((name) => `--color-${name}: var(--lt-${name});`),
    ...PROJECT_SWATCHES.light.map(
      (_, index) => `--color-swatch-${index}: var(--lt-swatch-${index});`,
    ),
    '--shadow-*: initial;',
    ...Object.keys(ELEVATION).map((level) => `--shadow-${level}: var(--lt-shadow-${level});`),
  ];
}

/** Values that never change with the theme. */
function staticThemeEntries(): string[] {
  const roles = Object.keys(FONT_FAMILIES) as Array<keyof typeof FONT_FAMILIES>;
  return [
    ...roles.map((role) => `--font-${TAILWIND_FONT_NAMES[role]}: ${fontStack(role)};`),
    ...Object.entries(RADIUS)
      .filter(([name]) => name !== 'full')
      .map(([name, value]) => `--radius-${name}: ${px(value)};`),
    ...Object.entries(EASING).map(
      ([name, points]) => `--ease-${kebab(name)}: ${cubicBezier(points)};`,
    ),
    ...Object.entries(BREAKPOINTS).map(([name, value]) => `--breakpoint-${name}: ${rem(value)};`),
    '--animate-shimmer: lt-shimmer 1.4s ease-in-out infinite;',
  ];
}

function durationVariables(collapsed: boolean): string[] {
  return Object.entries(DURATION).map(([name, value]) => {
    const effective = collapsed && name !== 'fade' ? 1 : value;
    return `--duration-${name}: ${effective}ms;`;
  });
}

function typeUtilities(): string[] {
  return Object.entries(TYPE_SCALE).map(([name, style]) =>
    block(`@utility type-${kebab(name)}`, [
      `font-family: var(--font-${TAILWIND_FONT_NAMES[style.family]});`,
      `font-size: ${rem(style.size)};`,
      `line-height: ${rem(style.lineHeight)};`,
      `font-weight: ${style.weight};`,
      `letter-spacing: ${style.tracking === '0' ? 'normal' : style.tracking};`,
    ]),
  );
}

/**
 * The whole web stylesheet for the design tokens: Tailwind v4 theme mapping,
 * light/dark runtime variables (system preference or `data-theme`), motion
 * durations (collapsed under reduced motion or `data-motion="calm"`) and one
 * `type-*` utility per type style. Written to dist/theme.css at build time.
 */
export function buildThemeCss(): string {
  const dark = themeVariables('dark');
  return [
    '/* Generated from packages/design-system/src/tokens by scripts/write-theme-css.mjs. Do not edit. */',
    block('@theme inline', inlineThemeEntries()),
    block('@theme', staticThemeEntries()),
    block(':root', [...themeVariables('light'), ...durationVariables(false)]),
    `@media (prefers-color-scheme: dark) {\n${block(":root:not([data-theme='light'])", dark, '  ')}\n}`,
    block(":root[data-theme='dark']", dark),
    `@media (prefers-reduced-motion: reduce) {\n${block(':root', durationVariables(true), '  ')}\n}`,
    block(":root[data-motion='calm']", durationVariables(true)),
    block('@keyframes lt-shimmer', [
      'from { background-position: 150% 0; }',
      'to { background-position: -50% 0; }',
    ]),
    ...typeUtilities(),
    '',
  ].join('\n\n');
}
