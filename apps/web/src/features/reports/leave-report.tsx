'use client';

import type { LeaveReport } from '@lintel/api-contracts';
import {
  Avatar,
  Card,
  CardHeader,
  cn,
  KpiTile,
  listItemEnter,
  Tooltip,
} from '@lintel/design-system/web';
import { motion } from 'motion/react';
import { swatchClass } from '@/features/tasks/task-presentation';
import { formatDays } from './report-format';
import { LegendItem, ReportBody, SplitBar } from './report-parts';
import { useLeaveReport } from './use-reports';

const days = (value: number) => value.toLocaleString('en-IN', { maximumFractionDigits: 1 });

function Kpis({ data }: { readonly data: LeaveReport }) {
  const taken = data.totals.days - data.totals.upcomingDays;
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <KpiTile
        label="Days taken"
        value={taken}
        goodDirection="none"
        format={days}
        detail="Working days, up to today"
      />
      <KpiTile
        label="Booked ahead"
        value={data.totals.upcomingDays}
        goodDirection="none"
        format={days}
        detail="Approved, after today"
      />
      <KpiTile
        label="People with leave"
        value={data.byPerson.length}
        goodDirection="none"
        detail={`${data.totals.requests} approved ${data.totals.requests === 1 ? 'request' : 'requests'}`}
      />
      <KpiTile
        label="Most used type"
        value={data.types[0]?.days ?? 0}
        goodDirection="none"
        format={days}
        detail={data.types[0] ? `days of ${data.types[0].name.toLowerCase()}` : 'No leave yet'}
      />
    </div>
  );
}

function ByPerson({ data }: { readonly data: LeaveReport }) {
  const colour = new Map(data.types.map((type) => [type.id, swatchClass(type.colorIndex)]));
  const name = new Map(data.types.map((type) => [type.id, type.name]));
  const largest = Math.max(1, ...data.byPerson.map((person) => person.days));
  return (
    <Card>
      <CardHeader
        title="By person"
        description="Approved leave in working days; weekends and studio holidays are never counted."
      />
      <ul className="flex flex-col gap-1 px-2 pb-3">
        {data.byPerson.map((person, index) => {
          const words = person.byType
            .map(
              (entry) =>
                `${formatDays(entry.days)} ${name.get(entry.typeId)?.toLowerCase() ?? 'leave'}`,
            )
            .join(', ');
          return (
            <motion.li
              key={person.user.id}
              {...listItemEnter(index)}
              className="grid grid-cols-[minmax(0,12rem)_minmax(0,1fr)_6rem] items-center gap-3 rounded-md px-3 py-2.5 max-sm:grid-cols-[minmax(0,1fr)_auto]"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <Avatar
                  name={person.user.fullName}
                  hue={person.user.avatarHue}
                  size="sm"
                  decorative
                />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate type-body-sm font-medium text-ink">
                    {person.user.fullName}
                  </span>
                  {person.team && (
                    <span className="truncate type-body-sm text-ink-faint">{person.team}</span>
                  )}
                </span>
              </span>
              <Tooltip content={`${person.user.fullName}: ${words}`}>
                <button
                  type="button"
                  aria-label={`${person.user.fullName}: ${words}`}
                  className="max-sm:col-span-2 max-sm:row-start-2 rounded-sm outline-offset-2"
                >
                  <SplitBar
                    className="h-2.5"
                    total={largest}
                    parts={person.byType.map((entry) => ({
                      key: entry.typeId,
                      value: entry.days,
                      className: colour.get(entry.typeId) ?? 'bg-ink-faint',
                    }))}
                  />
                </button>
              </Tooltip>
              <span className="flex flex-col items-end">
                <span className="font-mono text-[0.8125rem] text-ink tabular-nums">
                  {formatDays(person.days)}
                </span>
                {person.upcomingDays > 0 && (
                  <span className="type-body-sm text-ink-faint">
                    {formatDays(person.upcomingDays)} ahead
                  </span>
                )}
              </span>
            </motion.li>
          );
        })}
      </ul>
      <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-hairline px-5 py-3">
        {data.types.map((type) => (
          <LegendItem key={type.id} swatch={cn(swatchClass(type.colorIndex))}>
            {type.name} <span className="font-mono text-ink tabular-nums">{days(type.days)}</span>
          </LegendItem>
        ))}
      </div>
    </Card>
  );
}

/** Leave taken by person and type, from approved requests and recorded absences. */
export function LeaveReportView() {
  const report = useLeaveReport();
  return (
    <ReportBody
      query={report}
      label="leave report"
      isEmpty={(data) => data.byPerson.length === 0}
      empty={{
        title: 'No approved leave in this period',
        description:
          'Nobody in this view had approved leave or a recorded absence. Choose a longer period or clear the filters.',
      }}
    >
      {(data) => (
        <>
          <Kpis data={data} />
          <ByPerson data={data} />
          <p className="type-body-sm text-ink-faint">
            Reasons are never shown in reports. Leave types and allowances are the studio’s own
            examples; check statutory entitlements for your jurisdiction.
          </p>
        </>
      )}
    </ReportBody>
  );
}
