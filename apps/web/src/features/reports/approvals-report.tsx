'use client';

import type { ApprovalsReport } from '@lintel/api-contracts';
import {
  Avatar,
  Card,
  CardHeader,
  listItemEnter,
  ResponsiveTable,
  type TableColumn,
} from '@lintel/design-system/web';
import { ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { formatRelativeInstant } from '@/lib/format/dates';
import { formatDuration } from './report-format';
import { ReportBody } from './report-parts';
import { useApprovalsReport } from './use-reports';

type Kind = ApprovalsReport['kinds'][number]['kind'];

const KIND_WORDS: Readonly<Record<Kind, { title: string; one: string; many: string }>> = {
  deliverable_review: { title: 'Deliverable reviews', one: 'review', many: 'reviews' },
  leave_decision: { title: 'Leave decisions', one: 'decision', many: 'decisions' },
  scope_change: { title: 'Scope changes', one: 'decision', many: 'decisions' },
};

function linkTo(row: ApprovalsReport['slowest'][number]): string {
  if (row.kind === 'deliverable_review') return `/deliverables/${row.recordId}`;
  if (row.kind === 'leave_decision') return `/leave/${row.recordId}`;
  return row.projectId ? `/projects/${row.projectId}/scope` : '/approvals';
}

function KindCard({
  row,
  index,
}: {
  readonly row: ApprovalsReport['kinds'][number];
  readonly index: number;
}) {
  const words = KIND_WORDS[row.kind];
  return (
    <motion.section
      {...listItemEnter(index)}
      aria-labelledby={`kind-${row.kind}`}
      className="flex flex-col gap-3 rounded-lg border border-hairline bg-raised p-5"
    >
      <h2 id={`kind-${row.kind}`} className="type-body-sm text-ink-muted">
        {words.title}
      </h2>
      <div className="flex flex-col gap-0.5">
        <p className="type-display-lg text-ink tabular-nums">{formatDuration(row.medianHours)}</p>
        <p className="type-body-sm text-ink-faint">
          {row.decided === 0
            ? 'Nothing decided in this period'
            : `Median of ${row.decided} ${row.decided === 1 ? words.one : words.many}`}
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-3 border-t border-hairline pt-3">
        <div className="flex flex-col gap-0.5">
          <dt className="type-body-sm text-ink-faint">Slowest</dt>
          <dd className="font-mono text-[0.875rem] text-ink tabular-nums">
            {formatDuration(row.slowestHours)}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="type-body-sm text-ink-faint">Waiting now</dt>
          <dd className="font-mono text-[0.875rem] text-ink tabular-nums">{row.waiting}</dd>
          {row.oldestWaitingHours !== null && (
            <dd className="type-body-sm text-ink-faint">
              Oldest {formatDuration(row.oldestWaitingHours)}
            </dd>
          )}
        </div>
      </dl>
    </motion.section>
  );
}

function Slowest({ data }: { readonly data: ApprovalsReport }) {
  return (
    <Card>
      <CardHeader
        title="Slowest decisions"
        description="Decided in this period, longest wait first."
      />
      {data.slowest.length === 0 ? (
        <p className="px-5 pb-5 type-body-sm text-ink-faint">Nothing was decided in this period.</p>
      ) : (
        <ul className="flex flex-col px-2 pb-3">
          {data.slowest.map((row, index) => (
            <motion.li
              key={`${row.kind}-${row.recordId}-${row.requestedAt}`}
              {...listItemEnter(index)}
              className="relative flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-sunken/60"
            >
              <span className="w-20 shrink-0 font-mono text-[0.8125rem] text-ink tabular-nums">
                {formatDuration(row.hours)}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <Link
                  href={linkTo(row)}
                  className="lt-stretched-link truncate rounded-sm type-body-sm font-medium text-ink"
                >
                  {row.title}
                </Link>
                <span className="truncate type-body-sm text-ink-faint">
                  {[
                    KIND_WORDS[row.kind].title.replace(/s$/, ''),
                    row.context,
                    row.decider
                      ? `decided by ${row.decider.fullName} ${formatRelativeInstant(row.decidedAt)}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-faint" />
            </motion.li>
          ))}
        </ul>
      )}
    </Card>
  );
}

type DeciderRow = ApprovalsReport['byDecider'][number];

function ByDecider({ data }: { readonly data: ApprovalsReport }) {
  const columns: TableColumn<DeciderRow>[] = [
    {
      key: 'person',
      header: 'Decided by',
      primary: true,
      cell: (row) => (
        <span className="flex items-center gap-2.5">
          <Avatar name={row.decider.fullName} hue={row.decider.avatarHue} size="sm" decorative />
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium text-ink">{row.decider.fullName}</span>
            <span className="type-body-sm text-ink-faint">{KIND_WORDS[row.kind].title}</span>
          </span>
        </span>
      ),
    },
    {
      key: 'decided',
      header: 'Decided',
      align: 'end',
      cell: (row) => <span className="font-mono text-[0.8125rem] tabular-nums">{row.decided}</span>,
    },
    {
      key: 'median',
      header: 'Median',
      align: 'end',
      cell: (row) => (
        <span className="font-mono text-[0.8125rem] tabular-nums">
          {formatDuration(row.medianHours)}
        </span>
      ),
    },
    {
      key: 'slowest',
      header: 'Slowest',
      align: 'end',
      cell: (row) => (
        <span className="font-mono text-[0.8125rem] text-ink-muted tabular-nums">
          {formatDuration(row.slowestHours)}
        </span>
      ),
    },
  ];
  return (
    <Card>
      <CardHeader title="By person" description="Who made the decisions, and how quickly." />
      {data.byDecider.length === 0 ? (
        <p className="px-5 pb-5 type-body-sm text-ink-faint">
          Nobody decided anything in this period.
        </p>
      ) : (
        <ResponsiveTable
          caption="Turnaround by person"
          columns={columns}
          rows={data.byDecider}
          rowKey={(row) => `${row.kind}-${row.decider.id}`}
          className="px-2 pb-3 max-md:px-4"
        />
      )}
    </Card>
  );
}

/** Approvals turnaround: how long reviews, leave and scope decisions take, and who is waiting. */
export function ApprovalsReportView() {
  const report = useApprovalsReport();
  return (
    <ReportBody
      query={report}
      label="approvals report"
      isEmpty={(data) => data.kinds.every((kind) => kind.decided === 0 && kind.waiting === 0)}
      empty={{
        title: 'No decisions in this period',
        description:
          'Nothing was reviewed or decided, and nothing is waiting. Choose a longer period or clear the filters.',
      }}
    >
      {(data) => (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            {data.kinds.map((row, index) => (
              <KindCard key={row.kind} row={row} index={index} />
            ))}
          </div>
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <Slowest data={data} />
            <ByDecider data={data} />
          </div>
          <p className="type-body-sm text-ink-faint">
            Turnaround = decided − requested, in elapsed hours (nights and weekends included).
            Reviews count from each submitted version; leave from the request to its final decision;
            scope changes from proposal to approval or rejection.
          </p>
        </>
      )}
    </ReportBody>
  );
}
