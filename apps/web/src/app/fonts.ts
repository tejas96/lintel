import { Geist, Geist_Mono, Newsreader } from 'next/font/google';

/*
 * Font faces from the type tokens. The CSS variable names must match
 * FONT_FACE_VARIABLES in packages/design-system/src/theme-css (next/font only
 * accepts literal options, so they are written out here).
 */
export const displayFace = Newsreader({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  axes: ['opsz'],
  variable: '--font-face-display',
  display: 'swap',
});

export const uiFace = Geist({
  subsets: ['latin'],
  variable: '--font-face-ui',
  display: 'swap',
});

export const monoFace = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-face-mono',
  display: 'swap',
});
