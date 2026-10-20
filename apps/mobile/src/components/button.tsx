import { ActivityIndicator, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { haptics } from '@/feedback/haptics';
import { type AppTheme, useAppTheme } from '@/theme/app-theme';
import { RADIUS, SPACE, TOUCH_TARGET } from '@/theme/layout';
import { AppText } from './app-text';
import { Icon, type IconName } from './icon';
import { PressableScale } from './pressable-scale';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';

export interface ButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: ButtonVariant;
  readonly size?: 'md' | 'lg';
  readonly icon?: IconName;
  readonly loading?: boolean;
  readonly disabled?: boolean;
  /** Spoken instead of the label when the label alone is ambiguous. */
  readonly accessibilityLabel?: string;
  readonly accessibilityHint?: string;
  readonly fill?: boolean;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}

function paletteFor(theme: AppTheme, variant: ButtonVariant) {
  const { colors, status } = theme;
  switch (variant) {
    case 'primary':
      return { background: colors.accent, border: colors.accent, text: colors.onAccent };
    case 'secondary':
      return {
        background: colors.surfaceRaised,
        border: colors.borderStrong,
        text: colors.textPrimary,
      };
    case 'quiet':
      return { background: 'transparent', border: 'transparent', text: colors.accent };
    case 'danger':
      return {
        background: status.overdue.tint,
        border: status.overdue.tint,
        text: status.overdue.fg,
      };
  }
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  fill = false,
  style,
  testID,
}: ButtonProps) {
  const theme = useAppTheme();
  const palette = paletteFor(theme, variant);
  const inactive = disabled || loading;
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      {...(accessibilityHint ? { accessibilityHint } : {})}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={() => {
        if (variant === 'primary') haptics.press();
        onPress();
      }}
      style={[
        styles.base,
        {
          minHeight: size === 'lg' ? 52 : TOUCH_TARGET,
          backgroundColor: palette.background,
          borderColor: palette.border,
          opacity: disabled ? 0.45 : 1,
        },
        fill ? styles.fill : null,
        style,
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={palette.text} />
        ) : (
          <>
            {icon ? <Icon name={icon} size={18} color={palette.text} weight="medium" /> : null}
            <AppText variant="titleMd" color={palette.text} numberOfLines={1}>
              {label}
            </AppText>
          </>
        )}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: SPACE.lg,
    justifyContent: 'center',
  },
  fill: { flexGrow: 1, flexBasis: 0 },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.sm,
  },
});
