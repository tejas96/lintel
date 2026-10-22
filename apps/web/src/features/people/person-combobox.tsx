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
  /** People away during the work, with a short note ("Is on leave on 2 Nov") shown on their option. */
  readonly away?: ReadonlyMap<string, string>;
}

/** Pick one active person. Each field searches on its own. */
export function PersonCombobox({
  value,
  onValueChange,
  clearable = false,
  placeholder = 'Search people',
  excludeIds = [],
  label,
  away,
}: PersonComboboxProps) {
  const people = usePeopleOptions();
  const options = people.options
    .filter((option) => !excludeIds.includes(option.value))
    .map((option) => {
      const note = away?.get(option.value);
      if (!note) return option;
      return { ...option, description: [option.description, note].filter(Boolean).join(' · ') };
    });
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
