import { type Ref, useEffect } from 'react';
import { StyleSheet, TextInput, type TextInputInstance, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from '@/components/app-text';
import { useAppTheme } from '@/theme/app-theme';
import { RADIUS, SPACE } from '@/theme/layout';
import { timing } from '@/theme/motion';

export interface OtpCodeInputProps {
  readonly value: string;
  readonly length: number;
  readonly onChange: (code: string) => void;
  readonly onComplete: (code: string) => void;
  readonly hasError: boolean;
  /** Increments on each failed attempt; triggers the shake. */
  readonly errorCount: number;
  readonly disabled: boolean;
  readonly ref?: Ref<TextInputInstance>;
}

/**
 * One real input stretched over the boxes, so the keyboard's one-time-code
 * suggestion, SMS autofill and long-press Paste all work natively. Typing
 * fills the next box; the last digit submits.
 */
export function OtpCodeInput({
  value,
  length,
  onChange,
  onComplete,
  hasError,
  errorCount,
  disabled,
  ref,
}: OtpCodeInputProps) {
  const { colors, status } = useAppTheme();
  const shake = useSharedValue(0);
  useEffect(() => {
    if (errorCount === 0) return;
    const step = timing('instant');
    shake.set(
      withSequence(
        withTiming(-8, step),
        withTiming(8, step),
        withTiming(-5, step),
        withTiming(0, step),
      ),
    );
  }, [errorCount, shake]);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.get() }] }));

  return (
    <Animated.View style={[styles.row, shakeStyle]}>
      {digitSlots(length).map(({ slot, position }) => {
        const digit = value[position] ?? '';
        const isCaret = position === Math.min(value.length, length - 1) && !disabled;
        const borderColor = hasError
          ? status.overdue.solid
          : isCaret
            ? colors.focusRing
            : colors.borderStrong;
        return (
          <View
            key={slot}
            style={[
              styles.box,
              {
                borderColor,
                borderWidth: isCaret || hasError ? 1.5 : 1,
                backgroundColor: colors.surfaceRaised,
              },
            ]}
          >
            <AppText variant="displayMd" maxFontSizeMultiplier={1.1}>
              {digit}
            </AppText>
          </View>
        );
      })}
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(text) => {
          const digits = text.replace(/\D/g, '').slice(0, length);
          onChange(digits);
          if (digits.length === length) onComplete(digits);
        }}
        editable={!disabled}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={length}
        caretHidden
        selectionColor="transparent"
        accessibilityLabel={`Sign-in code, ${length} digits`}
        accessibilityHint="Type or paste the code from the SMS"
        style={styles.overlayInput}
      />
    </Animated.View>
  );
}

/** One box per digit; a box's position is its identity. */
function digitSlots(length: number) {
  return Array.from({ length }, (_, position) => ({ slot: `digit-${position + 1}`, position }));
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: SPACE.sm, justifyContent: 'space-between' },
  box: {
    flex: 1,
    aspectRatio: 0.82,
    maxWidth: 56,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayInput: {
    ...StyleSheet.absoluteFill,
    color: 'transparent',
    opacity: 0.02,
    fontSize: 1,
  },
});
