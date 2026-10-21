'use client';

import type { WorkloadReport, WorkloadSummaryView } from '@lintel/api-contracts';
import {
  Avatar,
  Card,
  CardHeader,
  ResponsiveTable,
  StatusPill,
  type TableColumn,
} from '@lintel/design-system/web';
import { LOAD_PRESENTATION } from '@/features/capacity/load-presentation';
import { formatDays, formatHours, formatRate } from './report-format';
import { SplitBar } from './report-parts';

const NUM = 'font-mono text-[0.8125rem] tabular-nums';

function LoadCell({ summary }: { readonly summary: WorkloadSummaryView }) {
  const presentation = LOAD_PRESENTATION[summary.status];
  return (
    <span className="flex min-w-40 flex-col items-end gap-1.5 md:items-stretch">
      <span className="flex items-center justify-end gap-2 md:justify-between">
        <span className={`${NUM} text-ink`}>{formatRate(summary.utilization)}</span>
        <StatusPill
          tone={presentation.tone}
          glyph={presentation.glyph}
          label={presentation.label}
          size="sm"
        />
      </span>
      <SplitBar
        className="hidden md:flex"
        total={Math.max(summary.availableMinutes, summary.plannedMinutes)}
        parts={[{ value: summary.plannedMinutes, className: presentation.bar }]}
      />
    </span>
  );
}

const hoursColumns = <T extends WorkloadSummaryView>(tracking: boolean): TableColumn<T>[] => [
  {
    key: 'available',
    header: 'Available',
    align: 'end',
    cell: (row) => (
      <span className={`${NUM} text-ink-muted`}>{formatHours(row.availableMinutes)}</span>
    ),
  },
  {
    key: 'planned',
    header: 'Planned',
    align: 'end',
    cell: (row) => (
      <span className="flex flex-col items-end">
        <span className={`${NUM} text-ink`}>{formatHours(row.plannedMinutes)}</span>
        {row.tentativeMinutes > 0 && (
          <span className="type-body-sm text-ink-faint">
            +{formatHours(row.tentativeMinutes)} draft
          </span>
        )}
      </span>
    ),
  },
  ...(tracking
    ? [
        {
          key: 'logged',
          header: 'Logged',
          align: 'end' as const,
          cell: (row: T) => (
            <span className={`${NUM} text-ink-muted`}>{formatHours(row.loggedMinutes)}</span>
          ),
        },
      ]
    : []),
  { key: 'load', header: 'Planned ÷ available', cell: (row) => <LoadCell summary={row} /> },
];

type PersonRow = WorkloadReport['byPerson'][number];
type TeamRow = WorkloadReport['byTeam'][number];

export function WorkloadByPerson({ data }: { readonly data: WorkloadReport }) {
  const columns: TableColumn<PersonRow>[] = [
    {
      key: 'person',
      header: 'Person',
      primary: true,
      cell: (row) => (
        <span className="flex items-center gap-2.5">
          <Avatar name={row.user.fullName} hue={row.user.avatarHue} size="sm" decorative />
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium text-ink">{row.user.fullName}</span>
            <span className="type-body-sm text-ink-faint">
              {[row.team, row.leaveDays > 0 ? `${formatDays(row.leaveDays)} on leave` : null]
                .filter(Boolean)
                .join(' · ') || 'No team'}
            </span>
          </span>
        </span>
      ),
    },
    ...hoursColumns<PersonRow>(data.workTrackingEnabled),
  ];
  const assumed = data.byPerson.filter((row) => row.tasksWithoutEstimate > 0).length;
  return (
    <Card>
      <CardHeader
        title="By person"
        description={
          assumed > 0
            ? `${assumed === 1 ? 'One person has' : `${assumed} people have`} tasks without an estimate; each counts as ${formatHours(data.defaultEstimateMinutes)}.`
            : 'Every scheduled task in this period has an estimate.'
        }
      />
      <ResponsiveTable
        caption="Workload by person"
        columns={columns}
        rows={data.byPerson}
        rowKey={(row) => row.user.id}
        className="px-2 pb-3 max-md:px-4"
      />
    </Card>
  );
}

export function WorkloadByTeam({ data }: { readonly data: WorkloadReport }) {
  const columns: TableColumn<TeamRow>[] = [
    {
      key: 'team',
      header: 'Team',
      primary: true,
      cell: (row) => (
        <span className="flex flex-col">
          <span className="font-medium text-ink">{row.team?.name ?? 'No team'}</span>
          <span className="type-body-sm text-ink-faint">
            {row.people} {row.people === 1 ? 'person' : 'people'}
          </span>
        </span>
      ),
    },
    ...hoursColumns<TeamRow>(data.workTrackingEnabled),
  ];
  return (
    <Card>
      <CardHeader title="By team" description="The sum of each team’s people." />
      <ResponsiveTable
        caption="Workload by team"
        columns={columns}
        rows={data.byTeam}
        rowKey={(row) => row.team?.id ?? 'none'}
        className="px-2 pb-3 max-md:px-4"
      />
    </Card>
  );
}
