import {
  DARK_COLORS,
  DARK_STATUS,
  LIGHT_COLORS,
  LIGHT_STATUS,
  PROJECT_SWATCHES,
  type StatusColor,
  type StatusTone,
  type ThemeColors,
} from '@lintel/design-system/tokens';
import { createContext, type ReactNode, use } from 'react';
import { useColorScheme } from 'react-native';

export interface AppTheme {
  readonly scheme: 'light' | 'dark';
  readonly colors: ThemeColors;
  readonly status: Readonly<Record<StatusTone, StatusColor>>;
  /** Neutral status (draft, pending, not started): never coloured. */
  readonly neutralStatus: StatusColor;
  readonly projectSwatches: readonly string[];
}

const LIGHT_THEME: AppTheme = {
  scheme: 'light',
  colors: LIGHT_COLORS,
  status: LIGHT_STATUS,
  neutralStatus: {
    fg: LIGHT_COLORS.textSecondary,
    tint: LIGHT_COLORS.surfaceSunken,
    solid: LIGHT_COLORS.borderStrong,
  },
  projectSwatches: PROJECT_SWATCHES.light,
};

const DARK_THEME: AppTheme = {
  scheme: 'dark',
  colors: DARK_COLORS,
  status: DARK_STATUS,
  neutralStatus: {
    fg: DARK_COLORS.textSecondary,
    tint: DARK_COLORS.surfaceSunken,
    solid: DARK_COLORS.borderStrong,
  },
  projectSwatches: PROJECT_SWATCHES.dark,
};

const ThemeContext = createContext<AppTheme>(LIGHT_THEME);

/** Light and dark follow the system setting. */
export function AppThemeProvider({ children }: { readonly children: ReactNode }) {
  const scheme = useColorScheme();
  return (
    <ThemeContext value={scheme === 'dark' ? DARK_THEME : LIGHT_THEME}>{children}</ThemeContext>
  );
}

export function useAppTheme(): AppTheme {
  return use(ThemeContext);
}

/** A project's identity colour (chips, stage bars). Never used for status. */
export function projectSwatch(theme: AppTheme, colorIndex: number): string {
  const swatches = theme.projectSwatches;
  return swatches[Math.abs(colorIndex) % swatches.length] ?? theme.colors.accent;
}
