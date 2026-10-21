'use client';

import type { DeliveryReport } from '@lintel/api-contracts';
import { Card, CardHeader, KpiTile, SegmentedControl, TrendBars } from '@lintel/design-system/web';
import { useState } from 'react';
import { useSession } from '@/features/session/session-provider';
import { todayIn } from '@/lib/format/dates';
import { DeliveryByPerson, DeliveryByProject, PeriodNumbers } from './delivery-tables';
import { formatRate, periodName, periodTick } from './report-format';
import { ReportBody } from './report-parts';
import { useDeliveryReport } from './use-reports';

const percent = (value: number) => `${Math.round(value * 100)}%`;
const whole = (value: number) => Math.round(value).toLocaleString('en-IN');
const plural = (count: number, noun: string) => `${count} ${count === 1 ? noun : `${noun}s`}`;

function Kpis({ data }: { readonly data: DeliveryReport }) {
  const { tasks, milestones } = data.totals;
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <KpiTile
        label="Tasks on time"
        value={tasks.onTimeRate ?? 0}
        format={(value) => (tasks.onTimeRate === null ? '–' : percent(value))}
        detail={`${tasks.onTime} of ${tasks.onTime + tasks.late} finished tasks`}
      />
      <KpiTile
        label="Milestones on time"
        value={milestones.onTimeRate ?? 0}
        format={(value) => (milestones.onTimeRate === null ? '–' : percent(value))}
        detail={`${milestones.onTime} of ${milestones.onTime + milestones.late} completed milestones`}
      />
      <KpiTile
        label="Finished late"
        value={tasks.late}
        goodDirection="down"
        format={whole}
        detail={
          tasks.averageDaysLate === null
            ? 'Nothing finished late'
            : `By ${tasks.averageDaysLate} ${tasks.averageDaysLate === 1 ? 'day' : 'days'} on average`
        }
      />
      <KpiTile
        label="Still open past due"
        value={tasks.openOverdue + milestones.openOverdue}
        goodDirection="down"
        format={whole}
        detail={`${plural(tasks.openOverdue, 'task')}, ${plural(milestones.openOverdue, 'milestone')}`}
      />
    </div>
  );
}

function Trend({ data, today }: { readonly data: DeliveryReport; readonly today: string }) {
  const [work, setWork] = useState<'tasks' | 'milestones'>('tasks');
  const unit = data.granularity === 'week' ? 'week' : 'month';
  return (
    <Card>
      <CardHeader
        title={`On time and late, by ${unit}`}
        description={`Finished ${work} by the ${unit} they were completed in. On time means on or before the due date.`}
        action={
          <SegmentedControl
            label="Show"
            size="sm"
            value={work}
            onValueChange={setWork}
            options={[
              { value: 'tasks', label: 'Tasks' },
              { value: 'milestones', label: 'Milestones' },
            ]}
          />
        }
      />
      <div className="flex flex-col gap-4 px-5 pb-5">
        <TrendBars
          label={`${work === 'tasks' ? 'Tasks' : 'Milestones'} finished on time and late, by ${unit}`}
          goodLabel="On time"
          badLabel="Late"
          height={120}
          data={data.byPeriod.map((period, index) => ({
            key: period.start,
            label: periodName(period, data.granularity, today),
            good: period[work].onTime,
            bad: period[work].late,
            tick:
              index % Math.ceil(data.byPeriod.length / 5) === 0
                ? periodTick(period, data.granularity, today)
                : '',
          }))}
        />
        <PeriodNumbers data={data} work={work} today={today} />
      </div>
    </Card>
  );
}

/** Delivery reliability: on time against late, per period, project and person. */
export function DeliveryReportView() {
  const { user } = useSession();
  const today = todayIn(user.timeZone);
  const report = useDeliveryReport();
  return (
    <ReportBody
      query={report}
      label="delivery report"
      isEmpty={(data) => {
        const { tasks, milestones } = data.totals;
        return (
          tasks.onTime +
            tasks.late +
            tasks.openOverdue +
            milestones.onTime +
            milestones.late +
            milestones.openOverdue ===
          0
        );
      }}
      empty={{
        title: 'Nothing was due or delivered in this period',
        description:
          'No task or milestone was finished, and nothing fell past due. Choose a longer period or clear the filters.',
      }}
    >
      {(data) => (
        <>
          <Kpis data={data} />
          <Trend data={data} today={today} />
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <DeliveryByProject rows={data.byProject} />
            <DeliveryByPerson rows={data.byPerson} />
          </div>
          <p className="type-body-sm text-ink-faint">
            On-time rate = finished on or before the due date ÷ finished,{' '}
            {formatRate(data.totals.tasks.onTimeRate)} for tasks in this view. Due dates are the
            latest approved ones; work without a due date is not counted.
          </p>
        </>
      )}
    </ReportBody>
  );
}
