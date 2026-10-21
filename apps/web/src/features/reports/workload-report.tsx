'use client';

import type { WorkloadReport } from '@lintel/api-contracts';
import { Card, CardHeader, KpiTile, StatusPill } from '@lintel/design-system/web';
import { LOAD_PRESENTATION } from '@/features/capacity/load-presentation';
import { useSession } from '@/features/session/session-provider';
import { todayIn } from '@/lib/format/dates';
import { formatHours } from './report-format';
import { ReportBody } from './report-parts';
import { useWorkloadReport } from './use-reports';
import { WorkloadChart } from './workload-chart';
import { WorkloadByPerson, WorkloadByTeam } from './workload-tables';

const hours = (minutes: number) => formatHours(minutes);
/** KPI values carry the unit in their label, so big numbers never wrap on phones. */
const wholeHours = (minutes: number) =>
  Math.round(minutes / 60).toLocaleString('en-IN', { maximumFractionDigits: 0 });

function Kpis({ data }: { readonly data: WorkloadReport }) {
  const { totals } = data;
  const load = LOAD_PRESENTATION[totals.status];
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <KpiTile
        label="Available hours"
        value={totals.availableMinutes}
        goodDirection="none"
        format={wholeHours}
        detail={`${data.byPerson.length} ${data.byPerson.length === 1 ? 'person' : 'people'}, after approved leave and holidays`}
      />
      <KpiTile
        label="Planned hours"
        value={totals.plannedMinutes}
        goodDirection="none"
        format={wholeHours}
        detail={
          totals.tentativeMinutes > 0
            ? `Plus ${hours(totals.tentativeMinutes)} in draft tasks`
            : 'Estimates of scheduled tasks'
        }
      />
      <KpiTile
        label="Planned ÷ available"
        value={totals.utilization ?? 0}
        goodDirection="none"
        format={(value) => (totals.utilization === null ? '–' : `${Math.round(value * 100)}%`)}
        detail={<StatusPill tone={load.tone} glyph={load.glyph} label={load.label} size="sm" />}
      />
      <KpiTile
        label="Logged hours"
        value={totals.loggedMinutes}
        goodDirection="none"
        format={wholeHours}
        detail={
          data.workTrackingEnabled
            ? 'From work sessions people timed'
            : 'Time tracking is switched off in Settings'
        }
      />
    </div>
  );
}

/** Workload and capacity: planned against available hours per person, team and period. */
export function WorkloadReportView() {
  const { user } = useSession();
  const today = todayIn(user.timeZone);
  const report = useWorkloadReport();
  return (
    <ReportBody
      query={report}
      label="workload report"
      isEmpty={(data) => data.byPerson.length === 0}
      empty={{
        title: 'Nobody to show',
        description:
          'No active person works on the projects in this view. Choose another project or team, or clear the filters.',
      }}
    >
      {(data) => (
        <>
          <Kpis data={data} />
          <Card>
            <CardHeader
              title={`Hours by ${data.granularity}`}
              description={
                data.coversAllProjects
                  ? 'Available time after leave and holidays, against the estimates of the work scheduled in each period.'
                  : 'Only work on the projects in this view counts as planned or logged; available time is each person’s whole week.'
              }
            />
            <div className="px-5 pb-5">
              <WorkloadChart data={data} today={today} />
            </div>
          </Card>
          <WorkloadByPerson data={data} />
          {data.byTeam.length > 1 && <WorkloadByTeam data={data} />}
          <p className="type-body-sm text-ink-faint">
            Planned = each task’s estimate ({formatHours(data.defaultEstimateMinutes)} when it has
            none) spread over its owner’s working days from its start to its due date. Available =
            working hours × capacity, less approved leave.
          </p>
        </>
      )}
    </ReportBody>
  );
}
