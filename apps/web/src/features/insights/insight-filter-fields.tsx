'use client';

import { Avatar, Combobox, type ComboboxOption, cn, Select } from '@lintel/design-system/web';
import { type ReactNode, useMemo } from 'react';
import { swatchClass } from '@/features/tasks/task-presentation';
import type { FilterOptions } from './use-filter-options';
import type { InsightFilters } from './use-insight-filters';

interface FieldsProps {
  readonly filters: InsightFilters;
  readonly onChange: (patch: Partial<InsightFilters>) => void;
  readonly options: FilterOptions;
  /** Stacked full-width fields (the phone sheet) or a row of compact ones. */
  readonly layout: 'row' | 'stack';
}

/** Project, manager and team controls; the manager filter is for the studio view only. */
export function InsightFilterFields({ filters, onChange, options, layout }: FieldsProps) {
  const projectOptions = useMemo<ComboboxOption[]>(
    () =>
      options.projects.map((project) => ({
        value: project.id,
        label: project.name,
        description: `${project.reference} · ${project.clientName}`,
        leading: (
          <span
            aria-hidden
            className={cn('size-2.5 rounded-[3px]', swatchClass(project.colorIndex))}
          />
        ),
      })),
    [options.projects],
  );
  const managerOptions = useMemo<ComboboxOption[]>(
    () =>
      options.managers.map((manager) => ({
        value: manager.id,
        label: manager.fullName,
        ...(manager.designation ? { description: manager.designation } : {}),
        leading: <Avatar name={manager.fullName} hue={manager.avatarHue} size="xs" decorative />,
      })),
    [options.managers],
  );
  const stack = layout === 'stack';
  const field = (label: string, control: ReactNode, width: string) =>
    stack ? (
      <div className="flex flex-col gap-1.5">
        <span className="type-label text-ink-muted">{label}</span>
        {control}
      </div>
    ) : (
      <div className={width}>{control}</div>
    );
  return (
    <>
      {field(
        'Project',
        <Combobox
          label="Project"
          options={projectOptions}
          value={filters.projectId}
          onValueChange={(projectId) => onChange({ projectId })}
          placeholder={options.business ? 'Every project' : 'All your projects'}
          emptyText="No project by that name."
          loading={options.loading}
          clearable
        />,
        'w-64',
      )}
      {options.business &&
        field(
          'Manager',
          <Combobox
            label="Manager"
            options={managerOptions}
            value={filters.managerUserId}
            onValueChange={(managerUserId) => onChange({ managerUserId })}
            placeholder="Any manager"
            emptyText="Nobody by that name manages a project."
            clearable
          />,
          'w-52',
        )}
      {options.teams.length > 1 &&
        field(
          'Team',
          <Select
            label="Team"
            value={filters.teamId ?? 'all'}
            onValueChange={(value) => onChange({ teamId: value === 'all' ? null : value })}
            options={[
              { value: 'all', label: 'Every team' },
              ...options.teams.map((team) => ({ value: team.id, label: team.name })),
            ]}
            className={stack ? 'w-full' : 'w-44'}
          />,
          '',
        )}
    </>
  );
}
