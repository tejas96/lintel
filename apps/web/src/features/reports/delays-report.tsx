'use client';

import type { DelaysReport } from '@lintel/api-contracts';
import { listItemEnter } from '@lintel/design-system/web';
import { motion } from 'motion/react';
import { DELAY_WORDS } from './delay-presentation';
import { DelaysByClient, DelaysByProject, SlowestWaits } from './delays-tables';
import { formatDuration } from './report-format';
import { ReportBody } from './report-parts';
import { useDelaysReport } from './use-learning-reports';

function KindCard({
  row,
  index,
}: {
  readonly row: DelaysReport['kinds'][number];
  readonly index: number;
}) {
  const words = DELAY_WORDS[row.kind];
  return (
    <motion.section
      {...listItemEnter(index)}
      aria-labelledby={`delay-${row.kind}`}
      className="flex flex-col gap-3 rounded-lg border border-hairline bg-raised p-5"
    >
      <h2 id={`delay-${row.kind}`} className="type-body-sm text-ink-muted">
        {words.title}
      </h2>
      <div className="flex flex-col gap-0.5">
        <p className="type-display-lg text-ink tabular-nums">{formatDuration(row.medianHours)}</p>
        <p className="type-body-sm text-ink-faint">
          {row.count === 0
            ? 'Nothing ended in this period'
            : `Median wait of ${row.count} ${row.count === 1 ? words.one : words.many}`}
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-3 border-t border-hairline pt-3">
        <div className="flex flex-col gap-0.5">
          <dt className="type-body-sm text-ink-faint">Delayed (over 48 h)</dt>
          <dd
            className={`font-mono text-[0.875rem] tabular-nums ${row.delayed > 0 ? 'text-overdue' : 'text-ink'}`}
          >
            {row.delayed} of {row.count}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="type-body-sm text-ink-faint">Waiting now</dt>
          <dd className="font-mono text-[0.875rem] text-ink tabular-nums">{row.waitingNow}</dd>
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

/** "Recurring delays for 2 clients and 3 projects: …", or that there are none. */
function recurringSentence(data: DelaysReport): string {
  const count = (rows: readonly { recurring: boolean }[]) =>
    rows.filter((row) => row.recurring).length;
  const clients = count(data.byClient);
  const projects = count(data.byProject);
  if (clients === 0 && projects === 0) return 'No client or project has a recurring delay.';
  const named = [
    clients > 0 ? `${clients} ${clients === 1 ? 'client' : 'clients'}` : null,
    projects > 0 ? `${projects} ${projects === 1 ? 'project' : 'projects'}` : null,
  ]
    .filter(Boolean)
    .join(' and ');
  return `Recurring delays for ${named}: ${data.recurringAfter} or more approvals that took longer than ${data.delayedAfterHours} hours in this period.`;
}

/** Recurring approval delays: client sign-offs, client waits and internal reviews by client and project. */
export function DelaysReportView() {
  const report = useDelaysReport();
  return (
    <ReportBody
      query={report}
      label="approval delays report"
      isEmpty={(data) => data.kinds.every((kind) => kind.count === 0 && kind.waitingNow === 0)}
      empty={{
        title: 'No approvals in this period',
        description:
          'No client sign-off, client wait or internal review ended, and nothing is waiting. Choose a longer period or clear the filters.',
      }}
    >
      {(data) => (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            {data.kinds.map((row, index) => (
              <KindCard key={row.kind} row={row} index={index} />
            ))}
          </div>
          <p className="type-body-sm text-ink-muted">{recurringSentence(data)}</p>
          <DelaysByClient rows={data.byClient} />
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <DelaysByProject rows={data.byProject} />
            <SlowestWaits data={data} />
          </div>
          <p className="type-body-sm text-ink-faint">
            Waits are elapsed hours (nights and weekends included). A client sign-off waits from the
            moment its milestone’s work was done (its last finished task, or the start of its due
            date) to the recorded sign-off; a client wait from the blocker being raised to its
            resolution; an internal review from submission to decision. Delayed = longer than{' '}
            {data.delayedAfterHours} hours. Clients are grouped by name, ignoring case and spaces at
            either end.
          </p>
        </>
      )}
    </ReportBody>
  );
}
