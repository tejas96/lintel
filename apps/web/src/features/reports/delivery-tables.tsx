'use client';

import type { DeliveryReport, DeliveryTallyView } from '@lintel/api-contracts';
import {
  Avatar,
  Button,
  Card,
  CardHeader,
  ResponsiveTable,
  type TableColumn,
} from '@lintel/design-system/web';
import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useId, useState } from 'react';
import { ProjectChip } from '@/features/tasks/task-presentation';
import { formatRate, periodName } from './report-format';
import { SplitBar } from './report-parts';

const NUM = 'font-mono text-[0.8125rem] tabular-nums';

/** "8 on time · 2 late", the rate and a split bar. */
function TallyCell({ tally }: { readonly tally: DeliveryTallyView }) {
  return (
    <span className="flex min-w-36 flex-col items-end gap-1 md:items-stretch">
      <span className="flex items-baseline justify-end gap-2 md:justify-between">
        <span className={`${NUM} text-ink`}>{formatRate(tally.onTimeRate)}</span>
        <span className="type-body-sm text-ink-faint">
          {tally.onTime} on time · {tally.late} late
        </span>
      </span>
      <SplitBar
        className="hidden md:flex"
        parts={[
          { value: tally.onTime, className: 'bg-on-track-solid' },
          { value: tally.late, className: 'bg-overdue-solid' },
        ]}
      />
    </span>
  );
}

type ProjectRow = DeliveryReport['byProject'][number];
type PersonRow = DeliveryReport['byPerson'][number];

export function DeliveryByProject({ rows }: { readonly rows: readonly ProjectRow[] }) {
  const columns: TableColumn<ProjectRow>[] = [
    {
      key: 'project',
      header: 'Project',
      primary: true,
      cell: (row) => (
        <span className="flex min-w-0 flex-col gap-0.5">
          <Link
            href={`/projects/${row.project.id}`}
            className="lt-stretched-link truncate rounded-sm font-medium text-ink"
          >
            {row.project.name}
          </Link>
          <span className="flex items-center gap-2 type-body-sm text-ink-faint">
            <ProjectChip project={row.project} showName={false} />
            {row.manager.fullName}
          </span>
        </span>
      ),
    },
    { key: 'tasks', header: 'Tasks', cell: (row) => <TallyCell tally={row.tasks} /> },
    {
      key: 'milestones',
      header: 'Milestones',
      cell: (row) => (
        <span className={`${NUM} text-ink-muted`}>
          {row.milestones.onTime + row.milestones.late === 0
            ? '–'
            : `${row.milestones.onTime} of ${row.milestones.onTime + row.milestones.late}`}
        </span>
      ),
    },
    {
      key: 'open',
      header: 'Past due, open',
      align: 'end',
      cell: (row) => (
        <span className={`${NUM} ${row.tasks.openOverdue > 0 ? 'text-overdue' : 'text-ink-faint'}`}>
          {row.tasks.openOverdue + row.milestones.openOverdue}
        </span>
      ),
    },
  ];
  return (
    <Card>
      <CardHeader
        title="By project"
        description="Lowest on-time rate first. Milestones: on time out of completed."
      />
      <ResponsiveTable
        caption="Delivery by project"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.project.id}
        className="px-2 pb-3 max-md:px-4"
      />
    </Card>
  );
}

export function DeliveryByPerson({ rows }: { readonly rows: readonly PersonRow[] }) {
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
            {row.team && <span className="type-body-sm text-ink-faint">{row.team}</span>}
          </span>
        </span>
      ),
    },
    { key: 'tasks', header: 'Tasks they own', cell: (row) => <TallyCell tally={row.tasks} /> },
    {
      key: 'late',
      header: 'Average lateness',
      align: 'end',
      cell: (row) => (
        <span className={`${NUM} text-ink-muted`}>
          {row.tasks.averageDaysLate === null ? '–' : `${row.tasks.averageDaysLate} d`}
        </span>
      ),
    },
  ];
  return (
    <Card>
      <CardHeader title="By person" description="Tasks counted for the person who owns them." />
      {rows.length === 0 ? (
        <p className="px-5 pb-5 type-body-sm text-ink-faint">No owned task was due or finished.</p>
      ) : (
        <ResponsiveTable
          caption="Delivery by person"
          columns={columns}
          rows={rows}
          rowKey={(row) => row.user.id}
          className="px-2 pb-3 max-md:px-4"
        />
      )}
    </Card>
  );
}

/** The chart's numbers as a table, on request. */
export function PeriodNumbers({
  data,
  work,
  today,
}: {
  readonly data: DeliveryReport;
  readonly work: 'tasks' | 'milestones';
  readonly today: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="quiet"
        size="sm"
        className="self-start"
        aria-expanded={open}
        aria-controls={id}
        trailingIcon={<ChevronDown aria-hidden className={open ? 'rotate-180' : undefined} />}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? 'Hide the numbers' : 'Show the numbers'}
      </Button>
      {open && (
        <div id={id} className="relative overflow-x-auto">
          <table className="w-full min-w-[28rem] border-separate border-spacing-0 type-body-sm">
            <caption className="sr-only">On time and late {work} by period</caption>
            <thead>
              <tr className="text-left text-ink-faint">
                {['Period', 'On time', 'Late', 'Rate', 'Past due, open'].map((head) => (
                  <th
                    key={head}
                    scope="col"
                    className="border-b border-hairline px-3 py-2 type-label font-medium"
                  >
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.byPeriod.map((period) => (
                <tr key={period.start}>
                  <th
                    scope="row"
                    className="border-b border-hairline px-3 py-2 text-left font-normal text-ink"
                  >
                    {periodName(period, data.granularity, today)}
                  </th>
                  <td className={`border-b border-hairline px-3 py-2 ${NUM}`}>
                    {period[work].onTime}
                  </td>
                  <td className={`border-b border-hairline px-3 py-2 ${NUM}`}>
                    {period[work].late}
                  </td>
                  <td className={`border-b border-hairline px-3 py-2 ${NUM}`}>
                    {formatRate(period[work].onTimeRate)}
                  </td>
                  <td className={`border-b border-hairline px-3 py-2 ${NUM}`}>
                    {period[work].openOverdue}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
