import { DARK_COLORS, LIGHT_COLORS } from '@lintel/design-system/tokens';
import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { AppProviders } from '@/providers/app-providers';
import {
  MOTION_COOKIE,
  parseCalmMotion,
  parseThemePreference,
  THEME_COOKIE,
} from '@/providers/preferences';
import { displayFace, monoFace, uiFace } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Lintel', template: '%s · Lintel' },
  description: 'Projects, people and the day’s work for interior design and architecture studios.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: LIGHT_COLORS.canvas },
    { media: '(prefers-color-scheme: dark)', color: DARK_COLORS.canvas },
  ],
};

export default async function RootLayout({ children }: { readonly children: ReactNode }) {
  const store = await cookies();
  const theme = parseThemePreference(store.get(THEME_COOKIE)?.value);
  const calmMotion = parseCalmMotion(store.get(MOTION_COOKIE)?.value);
  return (
    <html
      lang="en-IN"
      data-theme={theme === 'system' ? undefined : theme}
      data-motion={calmMotion ? 'calm' : undefined}
      className={`${displayFace.variable} ${uiFace.variable} ${monoFace.variable}`}
      suppressHydrationWarning
    >
      <body>
        <AppProviders initialTheme={theme} initialCalmMotion={calmMotion}>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
