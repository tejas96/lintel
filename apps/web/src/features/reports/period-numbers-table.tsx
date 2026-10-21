'use client';

import { Button } from '@lintel/design-system/web';
import { ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';
import { periodName } from './report-format';

const NUM = 'font-mono text-[0.8125rem] tabular-nums';

export interface PeriodColumn<T> {
  readonly header: string;
  readonly cell: (row: T) => string | number;
}

/** A chart's numbers per period as a plain table, one press away. */
export function PeriodNumbersTable<T extends { start: string; end: string }>({
  caption,
  rows,
  columns,
  granularity,
  today,
}: {
  readonly caption: string;
  readonly rows: readonly T[];
  readonly columns: readonly PeriodColumn<T>[];
  readonly granularity: 'week' | 'month';
  readonly today: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const cell = 'border-b border-hairline px-3 py-2';
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
            <caption className="sr-only">{caption}</caption>
            <thead>
              <tr className="text-left text-ink-faint">
                {['Period', ...columns.map((column) => column.header)].map((head) => (
                  <th key={head} scope="col" className={`${cell} type-label font-medium`}>
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.start}>
                  <th scope="row" className={`${cell} text-left font-normal text-ink`}>
                    {periodName(row, granularity, today)}
                  </th>
                  {columns.map((column) => (
                    <td key={column.header} className={`${cell} ${NUM}`}>
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
