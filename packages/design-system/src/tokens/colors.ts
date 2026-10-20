/**
 * "Linen & Cyanotype" colour tokens. Text tokens are at least 4.5:1 on every
 * surface of their theme (WCAG 2.x); see docs/DESIGN_SYSTEM.md.
 */
export interface ThemeColors {
  readonly canvas: string;
  readonly surface: string;
  readonly surfaceRaised: string;
  readonly surfaceSunken: string;
  readonly borderSubtle: string;
  readonly borderStrong: string;
  readonly textPrimary: string;
  readonly textSecondary: string;
  readonly textTertiary: string;
  readonly accent: string;
  readonly accentHover: string;
  readonly accentPressed: string;
  readonly onAccent: string;
  readonly accentSoft: string;
  readonly onAccentSoft: string;
  readonly clay: string;
  readonly claySoft: string;
  readonly sage: string;
  readonly sageSoft: string;
  readonly focusRing: string;
  readonly scrim: string;
  /** Deep cyanotype ground for the one "drawing sheet" moment per screen (hero, brand panel). */
  readonly blueprint: string;
  readonly onBlueprint: string;
  readonly onBlueprintMuted: string;
  readonly blueprintLine: string;
}

export const LIGHT_COLORS: ThemeColors = {
  canvas: '#F3EFE7',
  surface: '#FBF9F5',
  surfaceRaised: '#FFFFFF',
  surfaceSunken: '#EAE5DB',
  borderSubtle: '#E3DDD1',
  borderStrong: '#CBC3B4',
  textPrimary: '#1E1C19',
  textSecondary: '#57524A',
  textTertiary: '#6B645A',
  accent: '#2D44B0',
  accentHover: '#22379A',
  accentPressed: '#1C2E80',
  onAccent: '#FFFFFF',
  accentSoft: '#E5E9F8',
  onAccentSoft: '#22379A',
  clay: '#A9583A',
  claySoft: '#EBD9CC',
  sage: '#4F7556',
  sageSoft: '#DCE4D8',
  focusRing: '#2D44B0',
  scrim: 'rgba(20, 19, 17, 0.48)',
  blueprint: '#1C2E80',
  onBlueprint: '#F5F3EE',
  onBlueprintMuted: '#C3CBEF',
  blueprintLine: 'rgba(195, 203, 239, 0.16)',
};

export const DARK_COLORS: ThemeColors = {
  canvas: '#141311',
  surface: '#1B1916',
  surfaceRaised: '#23211D',
  surfaceSunken: '#0F0E0C',
  borderSubtle: '#2F2B26',
  borderStrong: '#46413A',
  textPrimary: '#EFEBE3',
  textSecondary: '#B9B2A6',
  textTertiary: '#948D81',
  accent: '#93A3F5',
  accentHover: '#A9B6F8',
  accentPressed: '#BCC6FA',
  onAccent: '#0F1430',
  accentSoft: '#222947',
  onAccentSoft: '#B5C1FA',
  clay: '#E09A78',
  claySoft: '#3A2A22',
  sage: '#93BE98',
  sageSoft: '#26302A',
  focusRing: '#93A3F5',
  scrim: 'rgba(0, 0, 0, 0.60)',
  blueprint: '#17204D',
  onBlueprint: '#EEF0FB',
  onBlueprintMuted: '#AEB8E6',
  blueprintLine: 'rgba(174, 184, 230, 0.14)',
};

/** Project identity colours (Gantt bars, chips). Never used for status. */
export const PROJECT_SWATCHES = {
  light: ['#2D44B0', '#A9583A', '#4F7556', '#4D6177', '#946A1E', '#7A4875'],
  dark: ['#93A3F5', '#E09A78', '#93BE98', '#9FB3C8', '#D9B26A', '#D49ACB'],
} as const;
