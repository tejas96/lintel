'use client';

import { Combobox } from '@lintel/design-system/web';
import { usePeopleOptions } from './use-people-options';

interface PersonComboboxProps {
  readonly value: string | null;
  readonly onValueChange: (userId: string | null) => void;
  readonly clearable?: boolean;
  readonly placeholder?: string;
  /** People who must not be offered (for example the person going on leave). */
  readonly excludeIds?: readonly string[];
  /** Accessible name when the combobox is not inside a Field. */
  readonly label?: string;
}

/** Pick one active person. Each field searches on its own. */
export function PersonCombobox({
  value,
  onValueChange,
  clearable = false,
  placeholder = 'Search people',
  excludeIds = [],
  label,
}: PersonComboboxProps) {
  const people = usePeopleOptions();
  const options =
    excludeIds.length === 0
      ? people.options
      : people.options.filter((option) => !excludeIds.includes(option.value));
  return (
    <Combobox
      {...(label ? { label } : {})}
      options={options}
      value={value}
      onValueChange={onValueChange}
      onQueryChange={people.onQueryChange}
      loading={people.loading}
      placeholder={placeholder}
      clearable={clearable}
      emptyText="Nobody by that name. Check the spelling."
    />
  );
}
