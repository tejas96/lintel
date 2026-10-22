'use client';

import { Avatar, Badge, cn, layoutSpring } from '@lintel/design-system/web';
import { ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useId, useState } from 'react';
import { AuditDiff } from './audit-diff';
import { actionLabel, entityLabel } from './audit-presentation';
import type { AuditItem } from './use-audit-log';

/** One recorded change: when, who, what kind of record and what was done; open for the details. */
export function AuditEntry({
  item,
  time,
}: {
  readonly item: AuditItem;
  /** Formats the time of day in the studio's time zone. */
  readonly time: Intl.DateTimeFormat;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const changed = item.before !== null || item.after !== null;
  return (
    <li className="border-b border-hairline last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        disabled={!changed}
        onClick={() => setOpen((value) => !value)}
        className="grid w-full grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-3 text-left transition-colors enabled:hover:bg-sunken/40 sm:grid-cols-[3.5rem_13rem_minmax(0,1fr)_auto]"
      >
        <time dateTime={item.createdAt} className="font-mono text-[0.75rem] text-ink-faint">
          {time.format(new Date(item.createdAt))}
        </time>
        <span className="flex min-w-0 items-center gap-2 type-body-sm text-ink max-sm:col-start-2">
          {item.actor ? (
            <>
              <Avatar name={item.actor.fullName} hue={item.actor.avatarHue} size="xs" decorative />
              <span className="truncate">{item.actor.fullName}</span>
            </>
          ) : (
            <span className="text-ink-muted">Lintel, automatically</span>
          )}
        </span>
        <span className="flex min-w-0 flex-col max-sm:col-span-2 max-sm:col-start-2 max-sm:row-start-2">
          <span className="flex min-w-0 items-center gap-2">
            <Badge className="h-5 px-1.5 text-[0.6875rem]">{entityLabel(item.entityType)}</Badge>
            <span className="truncate type-body-sm font-medium text-ink">
              {actionLabel(item.action)}
            </span>
          </span>
          <span className="truncate font-mono text-[0.6875rem] text-ink-faint">
            {item.action}
            {item.entityId && ` ${item.entityId.slice(0, 8)}`}
          </span>
        </span>
        {changed ? (
          <ChevronDown
            aria-hidden
            className={cn(
              'size-4 text-ink-faint transition-transform max-sm:row-start-1 max-sm:col-start-3',
              open && 'rotate-180',
            )}
          />
        ) : (
          <span className="sr-only">No details recorded</span>
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={layoutSpring}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 sm:pl-[4.75rem]">
              <AuditDiff before={item.before} after={item.after} names={item.names} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}
