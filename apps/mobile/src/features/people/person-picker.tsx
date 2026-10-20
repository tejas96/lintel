import type { UserSummary } from '@lintel/api-contracts';
import { ROLE_LABELS } from '@lintel/domain';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/app-text';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { useDebouncedValue } from '@/components/search-field';
import { TextField } from '@/components/text-field';
import { haptics } from '@/feedback/haptics';
import { usePeopleSearch } from '@/queries/account-queries';
import { useAppTheme } from '@/theme/app-theme';
import { RADIUS, SPACE, TOUCH_TARGET } from '@/theme/layout';

export interface PersonPickerProps {
  readonly label: string;
  readonly selected: UserSummary | null;
  readonly onSelect: (person: UserSummary | null) => void;
  readonly excludeUserIds?: readonly string[];
}

/** Search the studio directory and pick one colleague. */
export function PersonPicker({
  label,
  selected,
  onSelect,
  excludeUserIds = [],
}: PersonPickerProps) {
  const { colors } = useAppTheme();
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search.trim(), 300);
  const people = usePeopleSearch(debounced);
  if (selected) {
    return (
      <View
        style={[
          styles.selected,
          { backgroundColor: colors.surfaceRaised, borderColor: colors.borderSubtle },
        ]}
      >
        <Avatar user={selected} size={32} />
        <View style={styles.flex}>
          <AppText variant="label" tone="tertiary">
            {label}
          </AppText>
          <AppText variant="body">{selected.fullName}</AppText>
        </View>
        <Button label="Change" variant="quiet" onPress={() => onSelect(null)} />
      </View>
    );
  }
  const results = (people.data?.items ?? []).filter(
    (person) => !excludeUserIds.includes(person.id),
  );
  return (
    <View style={styles.picker}>
      <TextField
        label={label}
        value={search}
        onChangeText={setSearch}
        placeholder="Search by name"
        autoCorrect={false}
        returnKeyType="search"
      />
      <View style={styles.results}>
        {results.slice(0, 6).map((person) => (
          <PressableScale
            key={person.id}
            accessibilityRole="button"
            accessibilityLabel={`Choose ${person.fullName}`}
            onPress={() => {
              haptics.selection();
              onSelect(person);
            }}
            pressedScale={0.98}
            style={styles.result}
          >
            <Avatar user={person} size={28} />
            <View style={styles.flex}>
              <AppText variant="body">{person.fullName}</AppText>
              <AppText variant="bodySm" tone="secondary">
                {person.designation ?? ROLE_LABELS[person.role]}
                {person.team ? ` · ${person.team.name}` : ''}
              </AppText>
            </View>
            <Icon name="add" size={16} color={colors.accent} />
          </PressableScale>
        ))}
        {people.isSuccess && results.length === 0 ? (
          <AppText variant="bodySm" tone="secondary">
            No one matches “{debounced}”.
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  picker: { gap: SPACE.sm },
  results: { gap: 2 },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    minHeight: TOUCH_TARGET + 4,
  },
  selected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    padding: SPACE.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  flex: { flex: 1 },
});
