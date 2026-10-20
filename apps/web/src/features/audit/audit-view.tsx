'use client';

import {
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
  pageEnter,
  Select,
  SkeletonGroup,
  SkeletonText,
} from '@lintel/design-system/web';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { PersonCombobox } from '@/features/people/person-combobox';
import { useSession } from '@/features/session/session-provider';
import { describeError } from '@/lib/api/describe-error';
import { formatLongDate, todayIn } from '@/lib/format/dates';
import { AuditEntry } from './audit-entry';
import { ENTITY_LABELS } from './audit-presentation';
import { type AuditItem, useAuditLog } from './use-audit-log';

const FRAME = 'mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-6 md:px-10 md:py-9';
const ANY = 'any';

/** Entries grouped under the calendar day (studio time) they happened on. */
function byDay(items: readonly AuditItem[], timeZone: string) {
  const dayOf = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const groups = new Map<string, AuditItem[]>();
  for (const item of items) {
    const day = dayOf.format(new Date(item.createdAt));
    groups.set(day, [...(groups.get(day) ?? []), item]);
  }
  return [...groups.entries()];
}

/** The audit trail: who changed what and when, with the before and after of each change. */
export function AuditView() {
  const { user, can } = useSession();
  const [entityType, setEntityType] = useState<string>(ANY);
  const [actorUserId, setActorUserId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const allowed = can('audit.view');
  const log = useAuditLog(
    { entityType: entityType === ANY ? null : entityType, actorUserId, page },
    allowed,
  );
  const time = useMemo(
    () =>
      new Intl.DateTimeFormat('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
        timeZone: user.timeZone,
      }),
    [user.timeZone],
  );
  if (!allowed) {
    return (
      <div className={FRAME}>
        <ErrorState
          kind="forbidden"
          title="The audit log is for the owner and administrators"
          message="It records every important change in the studio."
        />
      </div>
    );
  }
  const today = todayIn(user.timeZone);
  const data = log.data;
  return (
    <div className={FRAME}>
      <motion.div {...pageEnter}>
        <PageHeader
          title="Audit log"
          description="Every important change in the studio: who made it, when, and what it was before. Entries can’t be edited or removed."
        />
      </motion.div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select
          label="Kind of record"
          value={entityType}
          onValueChange={(value) => {
            setEntityType(value);
            setPage(1);
          }}
          options={[
            { value: ANY, label: 'Every kind of record' },
            ...Object.entries(ENTITY_LABELS).map(([value, label]) => ({ value, label })),
          ]}
          className="sm:w-60"
        />
        <div className="sm:w-72">
          <PersonCombobox
            label="Changed by"
            value={actorUserId}
            onValueChange={(next) => {
              setActorUserId(next);
              setPage(1);
            }}
            placeholder="Changed by anyone"
            clearable
          />
        </div>
      </div>
      {log.isPending && (
        <SkeletonGroup label="Loading the audit log">
          <SkeletonText lines={10} />
        </SkeletonGroup>
      )}
      {log.isError && !data && (
        <ErrorState
          {...describeError(log.error, { resource: 'collection' })}
          onRetry={() => log.refetch()}
        />
      )}
      {data && data.items.length === 0 && (
        <EmptyState
          drawing="plan"
          title="Nothing recorded for this filter"
          description="Try another kind of record, or anyone."
        />
      )}
      {data && data.items.length > 0 && (
        <div
          className={
            log.isPlaceholderData ? 'flex flex-col gap-6 opacity-60' : 'flex flex-col gap-6'
          }
        >
          {byDay(data.items, user.timeZone).map(([day, items]) => (
            <section key={day} className="flex flex-col gap-2">
              <h2 className="type-title-md text-ink">
                {day === today ? 'Today' : formatLongDate(day)}
              </h2>
              <ul className="rounded-lg border border-hairline bg-raised">
                {items.map((item) => (
                  <AuditEntry key={item.id} item={item} time={time} />
                ))}
              </ul>
            </section>
          ))}
          {data.totalPages > 1 && (
            <nav aria-label="Pages" className="flex items-center justify-between gap-3">
              <Button size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Newer
              </Button>
              <span className="type-body-sm text-ink-muted">
                Page {data.page} of {data.totalPages}, {data.totalItems} entries
              </span>
              <Button
                size="sm"
                disabled={page >= data.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Older
              </Button>
            </nav>
          )}
        </div>
      )}
    </div>
  );
}
