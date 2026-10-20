import { StyleSheet, View } from 'react-native';
import { haptics } from '@/feedback/haptics';
import { useAppTheme } from '@/theme/app-theme';
import { RADIUS, SPACE, TOUCH_TARGET } from '@/theme/layout';
import { AppText } from './app-text';
import { PressableScale } from './pressable-scale';

export interface SegmentOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

export interface SegmentedControlProps<T extends string> {
  readonly options: readonly SegmentOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly accessibilityLabel: string;
}

/** Choice chips in a row; the selected one carries the single accent. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: SegmentedControlProps<T>) {
  const { colors } = useAppTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[styles.group, { backgroundColor: colors.surfaceSunken }]}
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
              if (selected) return;
              haptics.selection();
              onChange(option.value);
            }}
            pressedScale={0.96}
            style={[
              styles.segment,
              selected
                ? { backgroundColor: colors.surfaceRaised, borderColor: colors.borderSubtle }
                : { borderColor: 'transparent' },
            ]}
          >
            <AppText
              variant="label"
              color={selected ? colors.textPrimary : colors.textSecondary}
              numberOfLines={1}
            >
              {option.label}
            </AppText>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { flexDirection: 'row', borderRadius: RADIUS.md, padding: 3, gap: 3 },
  segment: {
    flex: 1,
    minHeight: TOUCH_TARGET - 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    paddingHorizontal: SPACE.sm,
  },
});
