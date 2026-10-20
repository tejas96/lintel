import type { ThemeColors } from '@lintel/design-system/tokens';
import { Text, type TextProps } from 'react-native';
import { useAppTheme } from '@/theme/app-theme';
import {
  ITALIC_DISPLAY_FACE,
  MAX_FONT_SCALE,
  TEXT_STYLES,
  type TextVariant,
} from '@/theme/typography';

type TextTone = 'primary' | 'secondary' | 'tertiary' | 'accent' | 'onAccent';

const TONE_COLOR: Readonly<Record<TextTone, keyof ThemeColors>> = {
  primary: 'textPrimary',
  secondary: 'textSecondary',
  tertiary: 'textTertiary',
  accent: 'accent',
  onAccent: 'onAccent',
};

export interface AppTextProps extends TextProps {
  readonly variant?: TextVariant;
  readonly tone?: TextTone;
  /** Overrides `tone`, e.g. a status foreground colour. */
  readonly color?: string;
  readonly italic?: boolean;
  readonly align?: 'left' | 'center' | 'right';
}

/** All text goes through here so type, colour and Dynamic Type limits stay consistent. */
export function AppText({
  variant = 'body',
  tone = 'primary',
  color,
  italic = false,
  align,
  style,
  ...props
}: AppTextProps) {
  const theme = useAppTheme();
  const isHeading = variant.startsWith('display') || variant === 'titleLg';
  return (
    <Text
      maxFontSizeMultiplier={MAX_FONT_SCALE[variant]}
      {...(isHeading ? { accessibilityRole: 'header' as const } : {})}
      {...props}
      style={[
        TEXT_STYLES[variant],
        { color: color ?? theme.colors[TONE_COLOR[tone]] },
        italic && variant.startsWith('display') ? { fontFamily: ITALIC_DISPLAY_FACE } : null,
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}
