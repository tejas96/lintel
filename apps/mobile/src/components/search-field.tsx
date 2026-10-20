import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useAppTheme } from '@/theme/app-theme';
import { RADIUS, SPACE, TOUCH_TARGET } from '@/theme/layout';
import { TEXT_STYLES } from '@/theme/typography';
import { Icon } from './icon';
import { IconButton } from './icon-button';

/** Debounced value for search-as-you-type without a request per keystroke. */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export interface SearchFieldProps {
  readonly value: string;
  readonly onChangeText: (text: string) => void;
  readonly placeholder: string;
}

export function SearchField({ value, onChangeText, placeholder }: SearchFieldProps) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.field, { backgroundColor: colors.surfaceSunken }]}>
      <Icon name="search" size={18} color={colors.textSecondary} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        selectionColor={colors.accent}
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel={placeholder}
        style={[TEXT_STYLES.body, styles.input, { color: colors.textPrimary }]}
      />
      {value ? (
        <IconButton
          icon="close"
          accessibilityLabel="Clear search"
          onPress={() => onChangeText('')}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    paddingLeft: SPACE.md,
    borderRadius: RADIUS.md,
    minHeight: TOUCH_TARGET,
  },
  input: { flex: 1, paddingVertical: SPACE.sm },
});
