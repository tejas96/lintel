'use client';

import type { Team } from '@lintel/api-contracts';
import { Button, IconButton, SegmentedControl, Select } from '@lintel/design-system/web';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatMonthLong } from '@/lib/format/dates';
import type { CapacityRange, CapacitySpan } from './use-capacity';

const SPANS = [
  { value: 'week', label: 'Week' },
  { value: 'fortnight', label: 'Fortnight' },
] as const;

/** "19–25 October", or "26 October – 8 November" across months. */
export function formatRange(range: CapacityRange): string {
  const fromDay = Number(range.from.slice(8));
  const toDay = Number(range.to.slice(8));
  const fromMonth = formatMonthLong(range.from);
  const toMonth = formatMonthLong(range.to);
  return fromMonth === toMonth
    ? `${fromDay}–${toDay} ${toMonth}`
    : `${fromDay} ${fromMonth} – ${toDay} ${toMonth}`;
}

interface CapacityControlsProps {
  readonly range: CapacityRange;
  readonly span: CapacitySpan;
  readonly onSpanChange: (span: CapacitySpan) => void;
  readonly onStep: (direction: -1 | 1) => void;
  readonly onToday: (() => void) | null;
  readonly teams: readonly Team[];
  readonly teamId: string | null;
  readonly onTeamChange: (teamId: string | null) => void;
}

/** Move through time a week or fortnight at a time, and narrow to one team. */
export function CapacityControls({
  range,
  span,
  onSpanChange,
  onStep,
  onToday,
  teams,
  teamId,
  onTeamChange,
}: CapacityControlsProps) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-1">
        <IconButton
          label={`Previous ${span}`}
          variant="secondary"
          size="sm"
          onClick={() => onStep(-1)}
        >
          <ChevronLeft aria-hidden />
        </IconButton>
        <IconButton label={`Next ${span}`} variant="secondary" size="sm" onClick={() => onStep(1)}>
          <ChevronRight aria-hidden />
        </IconButton>
        <h2 aria-live="polite" className="ml-3 type-display-md text-ink">
          {formatRange(range)}
        </h2>
        {onToday && (
          <Button variant="quiet" size="sm" className="ml-2" onClick={onToday}>
            Back to this week
          </Button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl
          label="How many days"
          value={span}
          onValueChange={onSpanChange}
          options={SPANS}
          size="sm"
        />
        {teams.length > 1 && (
          <Select
            label="Team"
            value={teamId ?? 'all'}
            onValueChange={(value) => onTeamChange(value === 'all' ? null : value)}
            options={[
              { value: 'all', label: 'Every team' },
              ...teams.map((team) => ({ value: team.id, label: team.name })),
            ]}
            className="h-9 w-44"
          />
        )}
      </div>
    </div>
  );
}
