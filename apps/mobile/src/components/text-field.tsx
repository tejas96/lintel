import { type Ref, useState } from 'react';
import {
  StyleSheet,
  TextInput,
  type TextInputInstance,
  type TextInputProps,
  View,
} from 'react-native';
import { useAppTheme } from '@/theme/app-theme';
import { RADIUS, SPACE, TOUCH_TARGET } from '@/theme/layout';
import { TEXT_STYLES } from '@/theme/typography';
import { AppText } from './app-text';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  readonly label: string;
  readonly hint?: string;
  readonly error?: string | null;
  readonly multiline?: boolean;
  readonly ref?: Ref<TextInputInstance>;
}

/** Labelled input with a visible focus state and an error spoken by screen readers. */
export function TextField({
  label,
  hint,
  error,
  multiline = false,
  onFocus,
  onBlur,
  ref,
  ...props
}: TextFieldProps) {
  const { colors, status } = useAppTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error
    ? status.overdue.solid
    : focused
      ? colors.focusRing
      : colors.borderStrong;
  return (
    <View style={styles.field}>
      <AppText variant="label" tone="secondary">
        {label}
      </AppText>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        {...(hint ? { accessibilityHint: hint } : {})}
        placeholderTextColor={colors.textTertiary}
        selectionColor={colors.accent}
        cursorColor={colors.accent}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        {...props}
        style={[
          TEXT_STYLES.body,
          styles.input,
          multiline ? styles.multiline : null,
          {
            color: colors.textPrimary,
            backgroundColor: colors.surfaceRaised,
            borderColor,
            borderWidth: focused || error ? 1.5 : 1,
          },
        ]}
      />
      {error ? (
        <AppText variant="bodySm" color={status.overdue.fg} accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="bodySm" tone="tertiary">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: SPACE.xs },
  input: {
    minHeight: TOUCH_TARGET + 4,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
  },
  multiline: { minHeight: 104, paddingTop: SPACE.md },
});
