/** Display preferences kept in cookies so the server renders the right theme on first paint. */
export const THEME_COOKIE = 'lintel_theme';
export const MOTION_COOKIE = 'lintel_motion';

export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export function parseThemePreference(value: string | undefined): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system';
}

export function parseCalmMotion(value: string | undefined): boolean {
  return value === 'calm';
}

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function writePreferenceCookie(name: string, value: string): void {
  // biome-ignore lint/suspicious/noDocumentCookie: a plain preference cookie, read on the server for first paint
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
}

/** Applies preferences to <html> immediately (CSS reads data-theme and data-motion). */
export function applyThemeAttribute(theme: ThemePreference): void {
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
}

export function applyMotionAttribute(calm: boolean): void {
  const root = document.documentElement;
  if (calm) root.dataset.motion = 'calm';
  else delete root.dataset.motion;
}
