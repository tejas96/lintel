'use client';

import type { ReworkReport } from '@lintel/api-contracts';
import { Card, CardHeader, KpiTile, TrendBars } from '@lintel/design-system/web';
import { useSession } from '@/features/session/session-provider';
import { todayIn } from '@/lib/format/dates';
import { PeriodNumbersTable } from './period-numbers-table';
import { formatRate, periodName, periodTick } from './report-format';
import { ReportBody } from './report-parts';
import { MostSentBack, ReworkByPerson, ReworkByProject } from './rework-tables';
import { useReworkReport } from './use-learning-reports';

const percent = (value: number) => `${Math.round(value * 100)}%`;

function Kpis({ data }: { readonly data: ReworkReport }) {
  const { totals } = data;
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <KpiTile
        label="Rework rate"
        value={totals.reworkRate ?? 0}
        goodDirection="none"
        format={(value) => (totals.reworkRate === null ? '–' : percent(value))}
        detail={`${totals.sentBack} of ${totals.reviewed} reviews sent back`}
      />
      <KpiTile
        label="Reviewed"
        value={totals.reviewed}
        goodDirection="none"
        detail={`${totals.approved} approved`}
      />
      <KpiTile
        label="Changes requested"
        value={totals.changesRequested}
        goodDirection="none"
        detail="Sent back to be revised"
      />
      <KpiTile
        label="Rejected"
        value={totals.rejected}
        goodDirection="none"
        detail="Sent back to be redone"
      />
    </div>
  );
}

function Trend({ data, today }: { readonly data: ReworkReport; readonly today: string }) {
  const unit = data.granularity;
  return (
    <Card>
      <CardHeader
        title={`Approved and sent back, by ${unit}`}
        description={`Deliverable versions by the ${unit} they were reviewed in.`}
      />
      <div className="flex flex-col gap-4 px-5 pb-5">
        <TrendBars
          label={`Reviewed versions approved and sent back, by ${unit}`}
          goodLabel="Approved"
          badLabel="Sent back"
          height={120}
          data={data.byPeriod.map((period, index) => ({
            key: period.start,
            label: periodName(period, data.granularity, today),
            good: period.approved,
            bad: period.sentBack,
            tick:
              index % Math.ceil(data.byPeriod.length / 5) === 0
                ? periodTick(period, data.granularity, today)
                : '',
          }))}
        />
        <PeriodNumbersTable
          caption={`Rework by ${unit}`}
          rows={data.byPeriod}
          granularity={data.granularity}
          today={today}
          columns={[
            { header: 'Reviewed', cell: (row) => row.reviewed },
            { header: 'Approved', cell: (row) => row.approved },
            { header: 'Changes requested', cell: (row) => row.changesRequested },
            { header: 'Rejected', cell: (row) => row.rejected },
            { header: 'Rework rate', cell: (row) => formatRate(row.reworkRate) },
          ]}
        />
      </div>
    </Card>
  );
}

/** Rework rate: deliverable versions sent back after review, per task, person and project. */
export function ReworkReportView() {
  const { user } = useSession();
  const today = todayIn(user.timeZone);
  const report = useReworkReport();
  return (
    <ReportBody
      query={report}
      label="rework report"
      isEmpty={(data) => data.totals.reviewed === 0}
      empty={{
        title: 'Nothing was reviewed in this period',
        description:
          'Rework is counted from deliverable reviews. Choose a longer period or clear the filters.',
      }}
    >
      {(data) => (
        <>
          <Kpis data={data} />
          <Trend data={data} today={today} />
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <MostSentBack data={data} />
            <ReworkByPerson rows={data.byPerson} />
          </div>
          <ReworkByProject rows={data.byProject} />
          <p className="type-body-sm text-ink-faint">
            Rework rate = versions sent back (changes requested or rejected) ÷ versions reviewed,{' '}
            {formatRate(data.totals.reworkRate)} in this view. Each submitted version counts once,
            on the day it was reviewed; versions still waiting for review are not counted.
          </p>
        </>
      )}
    </ReportBody>
  );
}
