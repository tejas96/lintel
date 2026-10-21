'use client';

import type { DelaySummaryView, DelaysReport } from '@lintel/api-contracts';
import {
  Card,
  CardHeader,
  listItemEnter,
  ResponsiveTable,
  StatusPill,
  type TableColumn,
} from '@lintel/design-system/web';
import { ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { ProjectChip } from '@/features/tasks/task-presentation';
import { formatRelativeInstant } from '@/lib/format/dates';
import { DELAY_WORDS, delayLink, kindSummary } from './delay-presentation';
import { formatDuration } from './report-format';

const NUM = 'font-mono text-[0.8125rem] tabular-nums';

function RecurringPill() {
  return <StatusPill tone="overdue" glyph="offTrack" label="Recurring" size="sm" />;
}

/** The numbers every delay table shares, after its own name column. */
function summaryColumns<T extends { total: DelaySummaryView }>(): TableColumn<T>[] {
  return [
    {
      key: 'delayed',
      header: 'Delayed',
      align: 'end',
      cell: ({ total }) => (
        <span className="flex flex-col items-end">
          <span className={`${NUM} ${total.delayed > 0 ? 'text-overdue' : 'text-ink'}`}>
            {total.delayed} of {total.count}
          </span>
          <span className="type-body-sm text-ink-faint">over 48 h</span>
        </span>
      ),
    },
    {
      key: 'median',
      header: 'Median wait',
      align: 'end',
      cell: ({ total }) => (
        <span className={`${NUM} text-ink`}>{formatDuration(total.medianHours)}</span>
      ),
    },
    {
      key: 'slowest',
      header: 'Slowest',
      align: 'end',
      hideOnPhone: true,
      cell: ({ total }) => (
        <span className={`${NUM} text-ink-muted`}>{formatDuration(total.slowestHours)}</span>
      ),
    },
    {
      key: 'waiting',
      header: 'Waiting now',
      align: 'end',
      cell: ({ total }) => (
        <span className="flex flex-col items-end">
          <span className={`${NUM} text-ink`}>{total.waitingNow}</span>
          {total.oldestWaitingHours !== null && (
            <span className="type-body-sm text-ink-faint">
              oldest {formatDuration(total.oldestWaitingHours)}
            </span>
          )}
        </span>
      ),
    },
  ];
}

type ClientRow = DelaysReport['byClient'][number];
type ProjectRow = DelaysReport['byProject'][number];

export function DelaysByClient({ rows }: { readonly rows: readonly ClientRow[] }) {
  const columns: TableColumn<ClientRow>[] = [
    {
      key: 'client',
      header: 'Client',
      primary: true,
      cell: (row) => (
        <span className="flex min-w-0 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium text-ink">{row.client}</span>
            {row.recurring && <RecurringPill />}
          </span>
          <span className="type-body-sm text-ink-faint">
            {row.projects === 1 ? '1 project' : `${row.projects} projects`} ·{' '}
            {kindSummary(row.kinds)}
          </span>
        </span>
      ),
    },
    ...summaryColumns<ClientRow>(),
  ];
  return (
    <Card>
      <CardHeader
        title="By client"
        description="Most delayed first. Recurring: three or more delayed approvals in this period."
      />
      <ResponsiveTable
        caption="Approval delays by client"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.client.toLowerCase()}
        className="px-2 pb-3 max-md:px-4"
      />
    </Card>
  );
}

export function DelaysByProject({ rows }: { readonly rows: readonly ProjectRow[] }) {
  const columns: TableColumn<ProjectRow>[] = [
    {
      key: 'project',
      header: 'Project',
      primary: true,
      cell: (row) => (
        <span className="flex min-w-0 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <Link
              href={`/projects/${row.project.id}`}
              className="lt-stretched-link truncate rounded-sm font-medium text-ink"
            >
              {row.project.name}
            </Link>
            {row.recurring && <RecurringPill />}
          </span>
          <span className="flex flex-wrap items-center gap-x-2 type-body-sm text-ink-faint">
            <ProjectChip project={row.project} showName={false} />
            {row.client}
          </span>
          <span className="type-body-sm text-ink-faint">{kindSummary(row.kinds)}</span>
        </span>
      ),
    },
    ...summaryColumns<ProjectRow>(),
  ];
  return (
    <Card>
      <CardHeader title="By project" description="Most delayed first." />
      <ResponsiveTable
        caption="Approval delays by project"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.project.id}
        className="px-2 pb-3 max-md:px-4"
      />
    </Card>
  );
}

/** The longest waits that ended in the period, each linking to its record. */
export function SlowestWaits({ data }: { readonly data: DelaysReport }) {
  return (
    <Card>
      <CardHeader title="Longest waits" description="Ended in this period, longest first." />
      {data.slowest.length === 0 ? (
        <p className="px-5 pb-5 type-body-sm text-ink-faint">No wait ended in this period.</p>
      ) : (
        <ul className="flex flex-col px-2 pb-3">
          {data.slowest.map((row, index) => (
            <motion.li
              key={`${row.kind}-${row.recordId}-${row.readyAt}`}
              {...listItemEnter(index)}
              className="relative flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-sunken/60"
            >
              <span className="w-20 shrink-0 font-mono text-[0.8125rem] text-ink tabular-nums">
                {formatDuration(row.hours)}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <Link
                  href={delayLink(row)}
                  className="lt-stretched-link truncate rounded-sm type-body-sm font-medium text-ink"
                >
                  {row.title}
                </Link>
                <span className="truncate type-body-sm text-ink-faint">
                  {[
                    DELAY_WORDS[row.kind].title,
                    row.context,
                    `ended ${formatRelativeInstant(row.resolvedAt)}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              {row.delayed && (
                <StatusPill tone="overdue" glyph="overdue" label="Delayed" size="sm" />
              )}
              <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-faint" />
            </motion.li>
          ))}
        </ul>
      )}
    </Card>
  );
}
