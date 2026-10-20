import { StyleSheet, View } from 'react-native';
import { haptics } from '@/feedback/haptics';
import { useAppTheme } from '@/theme/app-theme';
import { RADIUS, SPACE, TOUCH_TARGET } from '@/theme/layout';
import { AppText } from './app-text';
import { PressableScale } from './pressable-scale';

export interface ChoiceChipsProps<T extends string> {
  readonly options: readonly { readonly value: T; readonly label: string }[];
  readonly value: T | null;
  readonly onChange: (value: T) => void;
  readonly accessibilityLabel: string;
}

/** Wrapping single-choice chips for short option lists (categories, leave types). */
export function ChoiceChips<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: ChoiceChipsProps<T>) {
  const { colors } = useAppTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={styles.wrap}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <PressableScale
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected, checked: selected }}
            accessibilityLabel={option.label}
            onPress={() => {
              haptics.selection();
              onChange(option.value);
            }}
            pressedScale={0.96}
            style={[
              styles.chip,
              selected
                ? { backgroundColor: colors.accent, borderColor: colors.accent }
                : { backgroundColor: colors.surfaceRaised, borderColor: colors.borderStrong },
            ]}
          >
            <AppText variant="label" color={selected ? colors.onAccent : colors.textPrimary}>
              {option.label}
            </AppText>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  chip: {
    minHeight: TOUCH_TARGET - 4,
    justifyContent: 'center',
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
});
