'use client';

import type { EstimatesReport } from '@lintel/api-contracts';
import { Card, CardHeader, KpiTile, StatusPill, TrendBars } from '@lintel/design-system/web';
import { useSession } from '@/features/session/session-provider';
import { todayIn } from '@/lib/format/dates';
import { EFFORT_PRESENTATION, effortStatus } from './estimate-presentation';
import { EstimatesByPerson, EstimatesByTaskType, EstimatesByTemplate } from './estimates-tables';
import { PeriodNumbersTable } from './period-numbers-table';
import { formatHours, formatRate, periodName, periodTick } from './report-format';
import { ReportBody } from './report-parts';
import { useEstimatesReport } from './use-learning-reports';

const percent = (value: number) => `${Math.round(value * 100)}%`;
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

function Kpis({ data }: { readonly data: EstimatesReport }) {
  const { totals } = data;
  const status = effortStatus(totals.effortRatio);
  const presentation = status ? EFFORT_PRESENTATION[status] : null;
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <KpiTile
        label="Logged ÷ estimated"
        value={totals.effortRatio ?? 0}
        goodDirection="none"
        format={(value) => (totals.effortRatio === null ? '–' : percent(value))}
        detail={
          presentation ? (
            <StatusPill
              tone={presentation.tone}
              glyph={presentation.glyph}
              label={`${presentation.label} estimate`}
              size="sm"
            />
          ) : (
            'Nothing measured'
          )
        }
      />
      <KpiTile
        label="Within estimate"
        value={totals.withinRate ?? 0}
        goodDirection="none"
        format={(value) => (totals.withinRate === null ? '–' : percent(value))}
        detail={`${totals.within} of ${plural(totals.measured, 'measured task', 'measured tasks')} within 80–120 %`}
      />
      <KpiTile
        label="Over estimate"
        value={totals.over}
        goodDirection="none"
        detail={`Logged more than 120 %; ${totals.under} under 80 %`}
      />
      <KpiTile
        label="Not measured"
        value={totals.notMeasured + totals.withoutEstimate}
        goodDirection="none"
        detail={`${totals.notMeasured} with no time logged, ${totals.withoutEstimate} without an estimate`}
      />
    </div>
  );
}

function Trend({ data, today }: { readonly data: EstimatesReport; readonly today: string }) {
  const unit = data.granularity;
  return (
    <Card>
      <CardHeader
        title={`Within estimate, by ${unit}`}
        description={`Measured tasks by the ${unit} they were finished in: within 80–120 % of their estimate, or outside it (over or under).`}
      />
      <div className="flex flex-col gap-4 px-5 pb-5">
        <TrendBars
          label={`Measured tasks within and outside their estimate, by ${unit}`}
          goodLabel="Within"
          badLabel="Outside"
          badTone="atRisk"
          height={120}
          data={data.byPeriod.map((period, index) => ({
            key: period.start,
            label: periodName(period, data.granularity, today),
            good: period.within,
            bad: period.over + period.under,
            tick:
              index % Math.ceil(data.byPeriod.length / 5) === 0
                ? periodTick(period, data.granularity, today)
                : '',
          }))}
        />
        <PeriodNumbersTable
          caption={`Estimate accuracy by ${unit}`}
          rows={data.byPeriod}
          granularity={data.granularity}
          today={today}
          columns={[
            { header: 'Measured', cell: (row) => row.measured },
            { header: 'Within', cell: (row) => row.within },
            { header: 'Over', cell: (row) => row.over },
            { header: 'Under', cell: (row) => row.under },
            { header: 'Logged ÷ estimated', cell: (row) => formatRate(row.effortRatio) },
          ]}
        />
      </div>
    </Card>
  );
}

function emptyFor(data: EstimatesReport | undefined) {
  const finished = data
    ? data.totals.measured + data.totals.notMeasured + data.totals.withoutEstimate
    : 0;
  if (data && finished > 0 && !data.workTrackingEnabled) {
    return {
      title: 'Time tracking is switched off',
      description: `Estimates are compared with the time people log on tasks. ${plural(finished, 'task was', 'tasks were')} finished in this period without logged time. An administrator can switch time tracking on in Settings.`,
    };
  }
  if (finished > 0) {
    return {
      title: 'Nothing to compare yet',
      description: `${plural(finished, 'task was', 'tasks were')} finished in this period, but none had both an estimate and logged time. Add estimates when planning and time work as it happens.`,
    };
  }
  return {
    title: 'No tasks were finished in this period',
    description: 'Choose a longer period or clear the filters.',
  };
}

/** Estimate accuracy: estimated against logged effort per person, task type and template. */
export function EstimatesReportView() {
  const { user } = useSession();
  const today = todayIn(user.timeZone);
  const report = useEstimatesReport();
  return (
    <ReportBody
      query={report}
      label="estimate accuracy report"
      isEmpty={(data) => data.totals.measured === 0}
      empty={emptyFor(report.data)}
    >
      {(data) => (
        <>
          <Kpis data={data} />
          <Trend data={data} today={today} />
          <EstimatesByTaskType data={data} />
          <div className="grid items-start gap-6 xl:grid-cols-2">
            <EstimatesByPerson data={data} />
            <EstimatesByTemplate data={data} />
          </div>
          <p className="type-body-sm text-ink-faint">
            Logged ÷ estimated = time logged on finished tasks ÷ their estimates, counting only
            tasks with both ({formatHours(data.totals.loggedMinutes)} of{' '}
            {formatHours(data.totals.estimatedMinutes)} in this view). A task is within its estimate
            at 80–120 %, over above and under below. Finished tasks without logged time or without
            an estimate are counted apart and never enter the ratios.
            {!data.workTrackingEnabled &&
              ' Time tracking is switched off in Settings, so new work is not being measured.'}
          </p>
        </>
      )}
    </ReportBody>
  );
}
