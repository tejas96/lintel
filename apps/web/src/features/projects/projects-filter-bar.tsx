'use client';

import { Input, SegmentedControl, Select } from '@lintel/design-system/web';
import { PROJECT_TYPE_LABELS, PROJECT_TYPES } from '@lintel/domain';
import { LayoutGrid, Rows3, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PROJECT_STATUS_LABELS } from './project-presentation';
import type { HealthFilter, ProjectFilters, SortKey, StatusFilter } from './use-project-list';

const STATUS_OPTIONS: readonly { value: StatusFilter; label: string }[] = [
  { value: 'open', label: 'Open projects' },
  { value: 'all', label: 'All projects' },
  ...(['draft', 'active', 'on_hold', 'completed', 'cancelled', 'archived'] as const).map(
    (status) => ({
      value: status,
      label: PROJECT_STATUS_LABELS[status],
    }),
  ),
];

const HEALTH_OPTIONS: readonly { value: HealthFilter; label: string }[] = [
  { value: 'any', label: 'Any health' },
  { value: 'on_track', label: 'On track' },
  { value: 'at_risk', label: 'At risk' },
  { value: 'off_track', label: 'Off track' },
  { value: 'not_started', label: 'Not started' },
];

const TYPE_OPTIONS = [
  { value: 'any' as const, label: 'Every type' },
  ...PROJECT_TYPES.map((type) => ({ value: type, label: PROJECT_TYPE_LABELS[type] })),
];

const SORT_OPTIONS: readonly { value: SortKey; label: string }[] = [
  { value: 'plannedEndDate', label: 'Ending soonest' },
  { value: 'health', label: 'Needs attention first' },
  { value: 'name', label: 'Name' },
  { value: 'createdAt', label: 'Newest' },
];

/** One row of filters above the list; every change is written to the URL. */
export function ProjectsFilterBar({
  filters,
  onChange,
}: {
  readonly filters: ProjectFilters;
  readonly onChange: (patch: Partial<ProjectFilters>) => void;
}) {
  const [search, setSearch] = useState(filters.search);
  useEffect(() => {
    if (search === filters.search) return;
    const timer = window.setTimeout(() => onChange({ search: search.trim() }), 300);
    return () => window.clearTimeout(timer);
  }, [search, filters.search, onChange]);

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="min-w-0 flex-1 lg:min-w-72 lg:max-w-sm">
        <Input
          type="search"
          aria-label="Search projects by name, client or reference"
          placeholder="Search name, client or reference"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          leading={<Search aria-hidden />}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <Select
          label="Status"
          value={filters.status}
          onValueChange={(status) => onChange({ status })}
          options={STATUS_OPTIONS}
          className="sm:w-40"
        />
        <Select
          label="Health"
          value={filters.health}
          onValueChange={(health) => onChange({ health })}
          options={HEALTH_OPTIONS}
          className="sm:w-36"
        />
        <Select
          label="Project type"
          value={filters.projectType}
          onValueChange={(projectType) => onChange({ projectType })}
          options={TYPE_OPTIONS}
          className="sm:w-48"
        />
        <Select
          label="Sort"
          value={filters.sort}
          onValueChange={(sort) => onChange({ sort })}
          options={SORT_OPTIONS}
          className="sm:w-48"
        />
      </div>
      <SegmentedControl
        label="Layout"
        value={filters.view}
        onValueChange={(view) => onChange({ view, page: filters.page })}
        options={[
          { value: 'cards', label: 'Cards', icon: <LayoutGrid aria-hidden />, compactLabel: true },
          { value: 'table', label: 'Table', icon: <Rows3 aria-hidden />, compactLabel: true },
        ]}
        className="self-start lg:ml-auto"
      />
    </div>
  );
}
