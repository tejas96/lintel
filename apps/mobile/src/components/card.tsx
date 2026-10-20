import type { ReactNode } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { useAppTheme } from '@/theme/app-theme';
import { HAIRLINE, RADIUS, SPACE } from '@/theme/layout';
import { PressableScale } from './pressable-scale';

export interface CardProps {
  readonly children: ReactNode;
  readonly style?: StyleProp<ViewStyle>;
  readonly padded?: boolean;
  readonly tone?: 'surface' | 'raised' | 'sunken' | 'accentSoft';
  readonly onPress?: () => void;
  readonly onLongPress?: () => void;
  readonly accessibilityLabel?: string;
  readonly accessibilityHint?: string;
}

/** Paper, not glass: a flat warm surface with a hairline border and no shadow. */
export function Card({
  children,
  style,
  padded = true,
  tone = 'surface',
  onPress,
  onLongPress,
  accessibilityLabel,
  accessibilityHint,
}: CardProps) {
  const { colors } = useAppTheme();
  const background = {
    surface: colors.surface,
    raised: colors.surfaceRaised,
    sunken: colors.surfaceSunken,
    accentSoft: colors.accentSoft,
  }[tone];
  const cardStyle = [
    styles.card,
    { backgroundColor: background, borderColor: colors.borderSubtle },
    padded ? styles.padded : null,
    style,
  ];
  if (!onPress && !onLongPress) return <View style={cardStyle}>{children}</View>;
  return (
    <PressableScale
      accessibilityRole="button"
      {...(accessibilityLabel ? { accessibilityLabel } : {})}
      {...(accessibilityHint ? { accessibilityHint } : {})}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      pressedScale={0.985}
      style={cardStyle}
    >
      {children}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS.lg, borderWidth: HAIRLINE, overflow: 'hidden' },
  padded: { padding: SPACE.lg },
});
