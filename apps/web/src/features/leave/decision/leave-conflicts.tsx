import type { LeaveConflict } from '@lintel/api-contracts';
import { listItemEnter, StatusPill } from '@lintel/design-system/web';
import { motion } from 'motion/react';
import Link from 'next/link';
import { withReadableDates } from '@/lib/format/dates';

const KIND_WORDS: Readonly<Record<LeaveConflict['kind'], string>> = {
  due_during_leave: 'Due while away',
  work_during_leave: 'Planned while away',
  milestone_during_leave: 'Milestone while away',
};

/** Work the leave touches, critical first, each linked to its task. */
export function LeaveConflicts({ conflicts }: { readonly conflicts: readonly LeaveConflict[] }) {
  if (conflicts.length === 0) {
    return (
      <p className="rounded-md border border-hairline bg-raised px-4 py-3 type-body-sm text-ink-muted">
        No work is due or planned for these days.
      </p>
    );
  }
  const ordered = [...conflicts].sort((left, right) =>
    left.severity === right.severity ? 0 : left.severity === 'critical' ? -1 : 1,
  );
  return (
    <ul className="flex flex-col divide-y divide-hairline overflow-hidden rounded-lg border border-hairline bg-raised">
      {ordered.map((conflict, index) => (
        <motion.li
          key={`${conflict.taskId}-${conflict.kind}`}
          {...listItemEnter(index)}
          className="group relative flex flex-col gap-2 p-4 transition-colors hover:bg-sunken/40 sm:flex-row sm:items-start sm:gap-4"
        >
          <StatusPill
            tone={conflict.severity === 'critical' ? 'overdue' : 'atRisk'}
            glyph={conflict.severity === 'critical' ? 'overdue' : 'atRisk'}
            label={conflict.severity === 'critical' ? 'Critical' : 'Warning'}
            size="sm"
            className="self-start sm:mt-0.5 sm:w-[5.75rem] sm:justify-center"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <Link
              href={`/tasks/${conflict.taskId}`}
              className="lt-stretched-link rounded-sm type-body font-medium text-ink group-hover:underline"
            >
              {conflict.title}
            </Link>
            <p className="type-body-sm text-ink-muted">
              {conflict.projectName}
              <span className="text-ink-faint">, {KIND_WORDS[conflict.kind].toLowerCase()}</span>
            </p>
            <p className="type-body-sm text-ink-muted">{withReadableDates(conflict.explanation)}</p>
          </div>
        </motion.li>
      ))}
    </ul>
  );
}
