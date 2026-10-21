'use client';

import { Button, CountBadge, Sheet } from '@lintel/design-system/web';
import { SlidersHorizontal } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { type FilterChip, FilterChips } from './filter-chips';
import { InsightFilterFields } from './insight-filter-fields';
import { PeriodPicker, periodLabel } from './period-picker';
import type { FilterOptions } from './use-filter-options';
import type { InsightFilterKey, InsightFilters } from './use-insight-filters';

interface InsightFilterBarProps {
  readonly filters: InsightFilters;
  readonly onChange: (patch: Partial<InsightFilters>) => void;
  readonly onClear: () => void;
  readonly options: FilterOptions;
  readonly today: string;
  /** The range the server uses without a period, e.g. "Last 30 days". */
  readonly defaultPeriodLabel: string;
  /** Offer a forward-looking period (for planning views). */
  readonly ahead?: boolean;
  /** Right-aligned actions, such as a download. */
  readonly actions?: ReactNode;
}

const NONE = { from: null, to: null } as const;

function chipsFor(
  filters: InsightFilters,
  options: FilterOptions,
  today: string,
  defaultLabel: string,
): FilterChip[] {
  const pending = options.loading ? 'Loading…' : 'Not available';
  const chips: FilterChip[] = [];
  if (filters.from || filters.to) {
    chips.push({
      keys: ['from', 'to'],
      name: 'Period',
      value: periodLabel(filters.from, filters.to, today, defaultLabel),
    });
  }
  if (filters.projectId) {
    const project = options.projects.find((item) => item.id === filters.projectId);
    chips.push({ keys: ['projectId'], name: 'Project', value: project?.name ?? pending });
  }
  if (filters.managerUserId) {
    const manager = options.managers.find((item) => item.id === filters.managerUserId);
    chips.push({ keys: ['managerUserId'], name: 'Manager', value: manager?.fullName ?? pending });
  }
  if (filters.teamId) {
    const team = options.teams.find((item) => item.id === filters.teamId);
    chips.push({ keys: ['teamId'], name: 'Team', value: team?.name ?? pending });
  }
  return chips;
}

/**
 * Period, project, manager and team, written to the URL by the caller. Wide
 * screens show every control in one row; phones keep the period in view and
 * move the rest into a sheet. Active filters always show as chips.
 */
export function InsightFilterBar({
  filters,
  onChange,
  onClear,
  options,
  today,
  defaultPeriodLabel,
  ahead = false,
  actions,
}: InsightFilterBarProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const chips = chipsFor(filters, options, today, defaultPeriodLabel);
  const others = chips.filter((chip) => !chip.keys.includes('from')).length;
  const remove = (keys: readonly InsightFilterKey[]) =>
    onChange(Object.fromEntries(keys.map((key) => [key, null])));
  const period = (
    <PeriodPicker
      from={filters.from}
      to={filters.to}
      today={today}
      defaultLabel={defaultPeriodLabel}
      ahead={ahead}
      onChange={(range) => onChange(range.from ? range : NONE)}
      className="min-w-0 max-md:flex-1"
    />
  );
  return (
    <section aria-label="Filters" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {period}
        <div className="hidden items-center gap-2 md:flex md:flex-wrap">
          <InsightFilterFields
            filters={filters}
            onChange={onChange}
            options={options}
            layout="row"
          />
        </div>
        <Button
          variant="secondary"
          size="md"
          className="md:hidden"
          leadingIcon={<SlidersHorizontal aria-hidden />}
          onClick={() => setSheetOpen(true)}
        >
          Filters
          {others > 0 && (
            <CountBadge
              count={others}
              label={`${others} more ${others === 1 ? 'filter' : 'filters'} applied`}
            />
          )}
        </Button>
        {actions && <div className="flex items-center gap-2 md:ml-auto">{actions}</div>}
      </div>
      <FilterChips chips={chips} onRemove={remove} onClear={onClear} />
      <Sheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        side="bottom"
        title="Filters"
        description="Narrow the numbers to a project, a manager or a team."
        footer={
          <>
            {others > 0 && (
              <Button
                variant="quiet"
                onClick={() => onChange({ projectId: null, managerUserId: null, teamId: null })}
              >
                Clear
              </Button>
            )}
            <Button variant="primary" onClick={() => setSheetOpen(false)}>
              Show results
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4 px-5 py-5">
          <InsightFilterFields
            filters={filters}
            onChange={onChange}
            options={options}
            layout="stack"
          />
        </div>
      </Sheet>
    </section>
  );
}
