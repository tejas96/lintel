'use client';

import {
  cn,
  dataTransition,
  EmptyState,
  ErrorState,
  Skeleton,
  SkeletonGroup,
  useCalmMotion,
} from '@lintel/design-system/web';
import type { UseQueryResult } from '@tanstack/react-query';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { describeError } from '@/lib/api/describe-error';
import { formatCalendarDate } from '@/lib/format/dates';

/** What every report answers with: the range it counted and when the studio started. */
interface ReportMetaLike {
  readonly range: { readonly start: string; readonly end: string };
  readonly studioStartDate: string | null;
}

/**
 * Loading, failure and the dimmed "updating" state shared by every report.
 * Children render only with data; `empty` replaces them when the report has
 * nothing to show for these filters. A range cut short at the studio's
 * first day says so, so the numbers are not read as covering more.
 */
export function ReportBody<T extends ReportMetaLike>({
  query,
  label,
  isEmpty,
  empty,
  children,
}: {
  readonly query: UseQueryResult<T>;
  readonly label: string;
  readonly isEmpty: (data: T) => boolean;
  readonly empty: { readonly title: string; readonly description: string };
  readonly children: (data: T) => ReactNode;
}) {
  if (query.isPending) {
    return (
      <SkeletonGroup label={`Loading the ${label}`} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map((tile) => (
            <Skeleton key={tile} className="h-32 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </SkeletonGroup>
    );
  }
  if (query.isError && !query.data) {
    return (
      <ErrorState
        {...describeError(query.error, { resource: 'collection' })}
        onRetry={() => query.refetch()}
        retrying={query.isFetching}
      />
    );
  }
  const data = query.data;
  if (data === undefined) return null;
  return (
    <div
      aria-busy={query.isPlaceholderData}
      className={cn(
        'flex flex-col gap-6 transition-opacity',
        query.isPlaceholderData && 'opacity-60',
      )}
    >
      {data.studioStartDate !== null && data.range.start === data.studioStartDate && (
        <p className="type-body-sm text-ink-muted">
          Counted from {formatCalendarDate(data.studioStartDate, data.range.end)}, when the studio
          started: there is nothing to count before it.
        </p>
      )}
      {isEmpty(data) ? (
        <EmptyState drawing="plan" title={empty.title} description={empty.description} />
      ) : (
        children(data)
      )}
    </div>
  );
}

/**
 * Two parts of one whole on a track (on time / late, planned / free). Purely
 * visual: the numbers are always written next to it.
 */
export function SplitBar({
  parts,
  total,
  className,
}: {
  readonly parts: readonly {
    readonly key?: string;
    readonly value: number;
    readonly className: string;
  }[];
  /** The track's full length; defaults to the sum of the parts. */
  readonly total?: number;
  readonly className?: string;
}) {
  const calm = useCalmMotion();
  const sum = parts.reduce((acc, part) => acc + part.value, 0);
  const length = Math.max(total ?? sum, 1);
  return (
    <span
      aria-hidden
      className={cn('flex h-1.5 w-full overflow-hidden rounded-full bg-sunken', className)}
    >
      <motion.span
        className="flex h-full w-full gap-px"
        style={{ originX: 0 }}
        initial={calm ? false : { scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={dataTransition}
      >
        {parts.map((part) =>
          part.value > 0 ? (
            <span
              key={part.key ?? part.className}
              className={cn('h-full shrink-0', part.className)}
              style={{ width: `${((part.value / length) * 100).toFixed(2)}%` }}
            />
          ) : null,
        )}
      </motion.span>
    </span>
  );
}

/** A small key for a chart: swatch and words. */
export function LegendItem({
  swatch,
  children,
}: {
  readonly swatch: string;
  readonly children: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 type-body-sm text-ink-muted">
      <span aria-hidden className={cn('size-2.5 shrink-0 rounded-[3px]', swatch)} />
      {children}
    </span>
  );
}
