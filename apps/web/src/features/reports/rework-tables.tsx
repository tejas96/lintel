'use client';

import type { ReworkReport, ReworkTallyView } from '@lintel/api-contracts';
import {
  Avatar,
  Card,
  CardHeader,
  listItemEnter,
  ResponsiveTable,
  type TableColumn,
} from '@lintel/design-system/web';
import { pluralize } from '@lintel/shared';
import { ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { ProjectChip } from '@/features/tasks/task-presentation';
import { formatRate } from './report-format';
import { SplitBar } from './report-parts';

const NUM = 'font-mono text-[0.8125rem] tabular-nums';

/** The rate, "2 sent back of 9" and an approved / sent back split. */
function ReworkCell({ tally }: { readonly tally: ReworkTallyView }) {
  return (
    <span className="flex min-w-36 flex-col items-end gap-1 md:items-stretch">
      <span className="flex items-baseline justify-end gap-2 md:justify-between">
        <span className={`${NUM} text-ink`}>{formatRate(tally.reworkRate)}</span>
        <span className="type-body-sm text-ink-faint">
          {tally.sentBack} sent back of {tally.reviewed}
        </span>
      </span>
      <SplitBar
        className="hidden md:flex"
        parts={[
          { value: tally.approved, className: 'bg-on-track-solid' },
          { value: tally.sentBack, className: 'bg-overdue-solid' },
        ]}
      />
    </span>
  );
}

const decisionColumns = <T extends ReworkTallyView>(): TableColumn<T>[] => [
  { key: 'rate', header: 'Rework rate', cell: (row) => <ReworkCell tally={row} /> },
  {
    key: 'split',
    header: 'Changes · rejected',
    align: 'end',
    hideOnPhone: true,
    cell: (row) => (
      <span className={`${NUM} text-ink-muted`}>
        {row.changesRequested} · {row.rejected}
      </span>
    ),
  },
];

type ProjectRow = ReworkReport['byProject'][number];
type PersonRow = ReworkReport['byPerson'][number];

export function ReworkByProject({ rows }: { readonly rows: readonly ProjectRow[] }) {
  const columns: TableColumn<ProjectRow>[] = [
    {
      key: 'project',
      header: 'Project',
      primary: true,
      cell: (row) => (
        <span className="flex min-w-0 flex-col gap-0.5">
          <Link
            href={`/projects/${row.project.id}/deliverables`}
            className="lt-stretched-link truncate rounded-sm font-medium text-ink"
          >
            {row.project.name}
          </Link>
          <ProjectChip project={row.project} showName={false} />
        </span>
      ),
    },
    ...decisionColumns<ProjectRow>(),
  ];
  return (
    <Card>
      <CardHeader title="By project" description="Most sent back first." />
      <ResponsiveTable
        caption="Rework by project"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.project.id}
        className="px-2 pb-3 max-md:px-4"
      />
    </Card>
  );
}

export function ReworkByPerson({ rows }: { readonly rows: readonly PersonRow[] }) {
  const columns: TableColumn<PersonRow>[] = [
    {
      key: 'person',
      header: 'Submitted by',
      primary: true,
      cell: (row) => (
        <span className="flex items-center gap-2.5">
          <Avatar name={row.user.fullName} hue={row.user.avatarHue} size="sm" decorative />
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium text-ink">{row.user.fullName}</span>
            {row.team && <span className="type-body-sm text-ink-faint">{row.team}</span>}
          </span>
        </span>
      ),
    },
    ...decisionColumns<PersonRow>(),
  ];
  return (
    <Card>
      <CardHeader
        title="By person"
        description="Versions counted for the person who submitted them."
      />
      <ResponsiveTable
        caption="Rework by person"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.user.id}
        className="px-2 pb-3 max-md:px-4"
      />
    </Card>
  );
}

/** The tasks (or deliverables without a task) sent back most, each linking to its record. */
export function MostSentBack({ data }: { readonly data: ReworkReport }) {
  return (
    <Card>
      <CardHeader
        title="Sent back most"
        description="Tasks whose deliverables were sent back most in this period."
      />
      {data.mostSentBack.length === 0 ? (
        <p className="px-5 pb-5 type-body-sm text-ink-faint">
          Nothing was sent back in this period.
        </p>
      ) : (
        <ul className="flex flex-col px-2 pb-3">
          {data.mostSentBack.map((row, index) => (
            <motion.li
              key={`${row.kind}-${row.recordId}`}
              {...listItemEnter(index)}
              className="relative flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-sunken/60"
            >
              <span className="flex w-20 shrink-0 flex-col">
                <span className={`${NUM} text-ink`}>
                  {row.sentBack} of {row.reviewed}
                </span>
                <span className="type-body-sm text-ink-faint">sent back</span>
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <Link
                  href={
                    row.kind === 'task' ? `/tasks/${row.recordId}` : `/deliverables/${row.recordId}`
                  }
                  className="lt-stretched-link truncate rounded-sm type-body-sm font-medium text-ink"
                >
                  {row.title}
                </Link>
                <span className="truncate type-body-sm text-ink-faint">
                  {[
                    row.kind === 'task' ? 'Task' : 'Deliverable without a task',
                    row.context,
                    `${pluralize(row.changesRequested, 'change')} requested, ${row.rejected} rejected`,
                  ].join(' · ')}
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
