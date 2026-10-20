'use client';

import { Combobox } from '@lintel/design-system/web';
import { usePeopleOptions } from './use-people-options';

interface PersonComboboxProps {
  readonly value: string | null;
  readonly onValueChange: (userId: string | null) => void;
  readonly clearable?: boolean;
  readonly placeholder?: string;
}

/** Pick one active person. Each field searches on its own. */
export function PersonCombobox({
  value,
  onValueChange,
  clearable = false,
  placeholder = 'Search people',
}: PersonComboboxProps) {
  const people = usePeopleOptions();
  return (
    <Combobox
      options={people.options}
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
