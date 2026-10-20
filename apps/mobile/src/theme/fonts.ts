import { Geist_400Regular } from '@expo-google-fonts/geist/400Regular';
import { Geist_500Medium } from '@expo-google-fonts/geist/500Medium';
import { Geist_600SemiBold } from '@expo-google-fonts/geist/600SemiBold';
import { GeistMono_400Regular } from '@expo-google-fonts/geist-mono/400Regular';
import { GeistMono_500Medium } from '@expo-google-fonts/geist-mono/500Medium';
import { Newsreader_400Regular } from '@expo-google-fonts/newsreader/400Regular';
import { Newsreader_400Regular_Italic } from '@expo-google-fonts/newsreader/400Regular_Italic';
import { Newsreader_500Medium } from '@expo-google-fonts/newsreader/500Medium';
import type { FONT_FAMILIES } from '@lintel/design-system/tokens';

/** Only the faces the app uses are bundled (each weight is its own file). */
export const FONT_ASSETS = {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  GeistMono_400Regular,
  GeistMono_500Medium,
  Newsreader_400Regular,
  Newsreader_400Regular_Italic,
  Newsreader_500Medium,
} as const;

export type FontFace = keyof typeof FONT_ASSETS;
type FamilyRole = keyof typeof FONT_FAMILIES;

/**
 * React Native picks a face by family name, so each token weight maps to the
 * loaded face that draws it. Android ignores `fontWeight` for custom fonts.
 */
export function fontFaceFor(role: FamilyRole, weight: number, italic = false): FontFace {
  if (role === 'display') {
    if (italic) return 'Newsreader_400Regular_Italic';
    return weight >= 450 ? 'Newsreader_500Medium' : 'Newsreader_400Regular';
  }
  if (role === 'mono') return weight >= 500 ? 'GeistMono_500Medium' : 'GeistMono_400Regular';
  if (weight >= 600) return 'Geist_600SemiBold';
  if (weight >= 500) return 'Geist_500Medium';
  return 'Geist_400Regular';
}
