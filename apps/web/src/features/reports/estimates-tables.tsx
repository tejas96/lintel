'use client';

import type { EstimatesReport, EstimateTallyView } from '@lintel/api-contracts';
import {
  Avatar,
  Card,
  CardHeader,
  ResponsiveTable,
  type TableColumn,
} from '@lintel/design-system/web';
import type { ReactNode } from 'react';
import { EffortCell } from './estimate-presentation';
import { formatHours, formatRate } from './report-format';

const NUM = 'font-mono text-[0.8125rem] tabular-nums';

/** The columns every estimate table shares, after its own name column. */
function tallyColumns<T extends EstimateTallyView>(): TableColumn<T>[] {
  return [
    {
      key: 'measured',
      header: 'Measured',
      align: 'end',
      cell: (row) => {
        const finished = row.measured + row.notMeasured + row.withoutEstimate;
        return (
          <span className="flex flex-col items-end">
            <span className={`${NUM} text-ink`}>{row.measured}</span>
            <span className="type-body-sm text-ink-faint">of {finished} finished</span>
          </span>
        );
      },
    },
    {
      key: 'hours',
      header: 'Logged of estimated',
      align: 'end',
      hideOnPhone: true,
      cell: (row) => (
        <span className={`${NUM} text-ink-muted`}>
          {row.measured === 0
            ? '–'
            : `${formatHours(row.loggedMinutes)} of ${formatHours(row.estimatedMinutes)}`}
        </span>
      ),
    },
    { key: 'effort', header: 'Logged ÷ estimated', cell: (row) => <EffortCell tally={row} /> },
    {
      key: 'median',
      header: 'Median task',
      align: 'end',
      cell: (row) => <span className={`${NUM} text-ink-muted`}>{formatRate(row.medianRatio)}</span>,
    },
  ];
}

function TableCard<T extends EstimateTallyView>({
  title,
  description,
  caption,
  rows,
  rowKey,
  name,
  nameHeader,
  emptyText,
}: {
  readonly title: string;
  readonly description: string;
  readonly caption: string;
  readonly rows: readonly T[];
  readonly rowKey: (row: T) => string;
  readonly name: (row: T) => ReactNode;
  readonly nameHeader: string;
  readonly emptyText: string;
}) {
  const columns: TableColumn<T>[] = [
    { key: 'name', header: nameHeader, primary: true, cell: name },
    ...tallyColumns<T>(),
  ];
  return (
    <Card>
      <CardHeader title={title} description={description} />
      {rows.length === 0 ? (
        <p className="px-5 pb-5 type-body-sm text-ink-faint">{emptyText}</p>
      ) : (
        <ResponsiveTable
          caption={caption}
          columns={columns}
          rows={rows}
          rowKey={rowKey}
          className="px-2 pb-3 max-md:px-4"
        />
      )}
    </Card>
  );
}

export function EstimatesByPerson({ data }: { readonly data: EstimatesReport }) {
  return (
    <TableCard
      title="By person"
      description="Finished tasks counted for the person who owns them; logged time is everyone’s."
      caption="Estimate accuracy by person"
      nameHeader="Person"
      rows={data.byPerson}
      rowKey={(row) => row.user.id}
      emptyText="No owned task was finished in this period."
      name={(row) => (
        <span className="flex items-center gap-2.5">
          <Avatar name={row.user.fullName} hue={row.user.avatarHue} size="sm" decorative />
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium text-ink">{row.user.fullName}</span>
            {row.team && <span className="type-body-sm text-ink-faint">{row.team}</span>}
          </span>
        </span>
      )}
    />
  );
}

export function EstimatesByTaskType({ data }: { readonly data: EstimatesReport }) {
  return (
    <TableCard
      title="By task type"
      description="The same template task across projects; tasks added by hand are one group."
      caption="Estimate accuracy by task type"
      nameHeader="Task type"
      rows={data.byTaskType}
      rowKey={(row) => row.key ?? 'by-hand'}
      emptyText="No task was finished in this period."
      name={(row) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-ink">{row.name}</span>
          <span className="type-body-sm text-ink-faint">
            {row.template ?? 'Not from a template'}
          </span>
        </span>
      )}
    />
  );
}

export function EstimatesByTemplate({ data }: { readonly data: EstimatesReport }) {
  return (
    <TableCard
      title="By template"
      description="Projects grouped by the workflow template they were created from."
      caption="Estimate accuracy by template"
      nameHeader="Template"
      rows={data.byTemplate}
      rowKey={(row) => row.template?.id ?? 'none'}
      emptyText="No task was finished in this period."
      name={(row) => (
        <span className="truncate font-medium text-ink">{row.template?.name ?? 'No template'}</span>
      )}
    />
  );
}
