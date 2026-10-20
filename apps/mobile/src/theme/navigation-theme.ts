import { DarkTheme, DefaultTheme, type Theme } from 'expo-router';
import type { AppTheme } from './app-theme';
import { fontFaceFor } from './fonts';

/** Native headers, sheets and transitions take their colours and faces from the tokens. */
export function navigationThemeFor(theme: AppTheme): Theme {
  const base = theme.scheme === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    dark: theme.scheme === 'dark',
    colors: {
      ...base.colors,
      primary: theme.colors.accent,
      background: theme.colors.canvas,
      card: theme.colors.canvas,
      text: theme.colors.textPrimary,
      border: theme.colors.borderSubtle,
      notification: theme.status.overdue.solid,
    },
    fonts: {
      regular: { fontFamily: fontFaceFor('ui', 400), fontWeight: '400' },
      medium: { fontFamily: fontFaceFor('ui', 500), fontWeight: '500' },
      bold: { fontFamily: fontFaceFor('ui', 600), fontWeight: '600' },
      heavy: { fontFamily: fontFaceFor('ui', 600), fontWeight: '700' },
    },
  };
}
