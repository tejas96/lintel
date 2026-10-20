'use client';

import type { CommandCenter } from '@lintel/api-contracts';
import { KpiTile, TrendBars } from '@lintel/design-system/web';
import { formatCalendarDate } from '@/lib/format/dates';

const percent = (value: number) => `${Math.round(value * 100)}%`;
const whole = (value: number) => Math.round(value).toLocaleString('en-IN');

/** Eight live numbers, each with its change against the previous period where the server has one. */
export function CommandCenterKpis({
  data,
  today,
}: {
  readonly data: CommandCenter;
  readonly today: string;
}) {
  const { kpis, team } = data;
  const needAttention = kpis.projectsAtRisk.value + kpis.projectsOffTrack.value;
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <KpiTile
        label="Active projects"
        value={kpis.activeProjects.value}
        previousValue={kpis.activeProjects.previousValue}
        goodDirection="none"
        format={whole}
      />
      <KpiTile
        label="Projects needing attention"
        value={needAttention}
        goodDirection="down"
        format={whole}
        detail={`${kpis.projectsAtRisk.value} at risk, ${kpis.projectsOffTrack.value} off track`}
      />
      <KpiTile
        label="Overdue tasks"
        value={kpis.overdueTasks.value}
        previousValue={kpis.overdueTasks.previousValue}
        goodDirection="down"
        format={whole}
      />
      <KpiTile
        label="Delivered on time"
        className="order-first col-span-2 xl:order-none xl:col-span-1"
        value={kpis.onTimeDeliveryRate.value}
        previousValue={kpis.onTimeDeliveryRate.previousValue}
        format={percent}
        detail={
          kpis.onTimeDeliveryRate.sampleSize
            ? `${kpis.onTimeDeliveryRate.sampleSize} tasks finished in this period`
            : 'Nothing finished in this period yet'
        }
        chart={
          data.deliveryTrend.length > 0 && (
            <TrendBars
              label="Tasks finished on time and late, by week"
              goodLabel="On time"
              badLabel="Late"
              height={56}
              data={data.deliveryTrend.map((week) => ({
                key: week.weekStart,
                label: `Week of ${formatCalendarDate(week.weekStart, today)}`,
                good: week.onTime,
                bad: week.late,
              }))}
            />
          )
        }
      />
      <KpiTile
        label="Blocked tasks"
        value={kpis.blockedTasks.value}
        goodDirection="down"
        format={whole}
      />
      <KpiTile label="Due today" value={kpis.dueToday.value} goodDirection="none" format={whole} />
      <KpiTile
        label="Decisions waiting"
        value={kpis.pendingApprovals.value}
        goodDirection="down"
        format={whole}
      />
      <KpiTile
        label="Available today"
        className="col-span-2 xl:col-span-1"
        value={team.availableToday}
        goodDirection="up"
        format={whole}
        detail={`of ${team.headcount} people`}
      />
    </div>
  );
}
