'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { listItemEnter } from '../motion/presets';

export interface TableColumn<TRow> {
  readonly key: string;
  readonly header: string;
  readonly cell: (row: TRow) => ReactNode;
  readonly className?: string;
  /** On phones, columns collapse into a card; `primary` is the card's title. */
  readonly primary?: boolean;
  readonly hideOnPhone?: boolean;
  readonly align?: 'start' | 'end';
}

interface ResponsiveTableProps<TRow> {
  readonly caption: string;
  readonly columns: readonly TableColumn<TRow>[];
  readonly rows: readonly TRow[];
  readonly rowKey: (row: TRow) => string;
  readonly className?: string | undefined;
}

/**
 * A table on wide screens and a stack of cards on phones, from one definition.
 * To make a whole row clickable, give the primary cell's link the `lt-stretched-link` class.
 */
export function ResponsiveTable<TRow>({
  caption,
  columns,
  rows,
  rowKey,
  className,
}: ResponsiveTableProps<TRow>) {
  const primary = columns.find((column) => column.primary) ?? columns[0];
  const secondary = columns.filter((column) => column !== primary && !column.hideOnPhone);
  return (
    <div className={className}>
      <table className="hidden w-full border-separate border-spacing-0 md:table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  'sticky top-0 z-[1] border-b border-hairline bg-surface px-4 py-2.5 type-label font-medium text-ink-faint',
                  column.align === 'end' ? 'text-right' : 'text-left',
                  column.className,
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <motion.tr key={rowKey(row)} {...listItemEnter(index)} className="group relative">
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    'border-b border-hairline px-4 py-3 align-middle type-body text-ink transition-colors group-hover:bg-sunken/50',
                    column.align === 'end' && 'text-right',
                    column.className,
                  )}
                >
                  {column.cell(row)}
                </td>
              ))}
            </motion.tr>
          ))}
        </tbody>
      </table>
      <ul aria-label={caption} className="flex flex-col gap-2 md:hidden">
        {rows.map((row, index) => (
          <motion.li
            key={rowKey(row)}
            {...listItemEnter(index)}
            className="relative rounded-lg border border-hairline bg-raised p-4"
          >
            {primary && <div className="mb-3 type-title-md text-ink">{primary.cell(row)}</div>}
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              {secondary.map((column) => (
                <div key={column.key} className="contents">
                  <dt className="type-body-sm text-ink-faint">{column.header}</dt>
                  <dd className="min-w-0 justify-self-end text-right type-body-sm text-ink">
                    {column.cell(row)}
                  </dd>
                </div>
              ))}
            </dl>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
