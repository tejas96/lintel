import type {
  ApprovalsReport,
  DeliveryReport,
  DeliveryTallyView,
  LeaveReport,
  WorkloadReport,
  WorkloadSummaryView,
} from '@lintel/api-contracts';
import type { CsvCell } from './csv-encoder';

export interface CsvTable {
  readonly header: readonly string[];
  readonly rows: CsvCell[][];
}

export const hours = (minutes: number) => Math.round((minutes / 60) * 10) / 10;
export const percent = (ratio: number | null) =>
  ratio === null ? null : Math.round(ratio * 1000) / 10;

const LOAD_WORDS = {
  available: 'Has room',
  balanced: 'Balanced',
  stretched: 'Stretched',
  overloaded: 'Overloaded',
} as const;

const APPROVAL_WORDS = {
  deliverable_review: 'Deliverable review',
  leave_decision: 'Leave decision',
  scope_change: 'Scope change',
} as const;

/** "2026-10-21 14:05" in the studio timezone. */
export function localInstant(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')} ${part('hour')}:${part('minute')}`;
}

const tallyCells = (tally: DeliveryTallyView): CsvCell[] => [
  tally.onTime,
  tally.late,
  tally.openOverdue,
  percent(tally.onTimeRate),
  tally.averageDaysLate,
];

export function deliveryCsv(report: DeliveryReport): CsvTable {
  const rows: CsvCell[][] = [];
  const both = (
    group: string,
    name: string,
    detail: string | null,
    pair: DeliveryReport['totals'],
  ) => {
    rows.push([group, name, detail, 'Tasks', ...tallyCells(pair.tasks)]);
    rows.push([group, name, detail, 'Milestones', ...tallyCells(pair.milestones)]);
  };
  both('Total', 'All projects in this report', null, report.totals);
  for (const row of report.byProject) {
    both('Project', row.project.name, `${row.project.reference} · ${row.manager.fullName}`, row);
  }
  for (const row of report.byPerson) {
    rows.push(['Person', row.user.fullName, row.team, 'Tasks', ...tallyCells(row.tasks)]);
  }
  for (const row of report.byPeriod) both('Period', `${row.start} to ${row.end}`, null, row);
  return {
    header: [
      'Group',
      'Name',
      'Detail',
      'Work',
      'On time',
      'Late',
      'Still open past due',
      'On-time rate %',
      'Average days late',
    ],
    rows,
  };
}

const workloadCells = (summary: WorkloadSummaryView): CsvCell[] => [
  hours(summary.availableMinutes),
  hours(summary.plannedMinutes),
  hours(summary.tentativeMinutes),
  hours(summary.loggedMinutes),
  percent(summary.utilization),
  LOAD_WORDS[summary.status],
];

export function workloadCsv(report: WorkloadReport): CsvTable {
  return {
    header: [
      'Group',
      'Name',
      'Team',
      'Available hours',
      'Planned hours',
      'Tentative hours',
      'Logged hours',
      'Planned ÷ available %',
      'Load',
      'Approved leave days',
      'Tasks without an estimate',
    ],
    rows: [
      ['Total', 'Everyone in this report', null, ...workloadCells(report.totals), null, null],
      ...report.byPerson.map((row): CsvCell[] => [
        'Person',
        row.user.fullName,
        row.team,
        ...workloadCells(row),
        row.leaveDays,
        row.tasksWithoutEstimate,
      ]),
      ...report.byTeam.map((row): CsvCell[] => [
        'Team',
        row.team?.name ?? 'No team',
        null,
        ...workloadCells(row),
        null,
        null,
      ]),
      ...report.byPeriod.map((row): CsvCell[] => [
        'Period',
        `${row.start} to ${row.end}`,
        null,
        ...workloadCells(row),
        null,
        null,
      ]),
    ],
  };
}

export function leaveCsv(report: LeaveReport): CsvTable {
  const typeName = new Map(report.types.map((type) => [type.id, type.name]));
  return {
    header: ['Person', 'Team', 'Leave type', 'Requests', 'Days', 'Of which still ahead'],
    rows: [
      ...report.byPerson.flatMap((person) =>
        person.byType.map((entry): CsvCell[] => [
          person.user.fullName,
          person.team,
          typeName.get(entry.typeId) ?? 'Leave',
          entry.requests,
          entry.days,
          entry.upcomingDays,
        ]),
      ),
      ...report.types.map((type): CsvCell[] => [
        'All people',
        null,
        type.name,
        type.requests,
        type.days,
        type.upcomingDays,
      ]),
    ],
  };
}

export function approvalsCsv(report: ApprovalsReport, timeZone: string): CsvTable {
  return {
    header: [
      'Group',
      'Approval',
      'Name',
      'Detail',
      'Decided',
      'Median hours',
      'Slowest hours',
      'Waiting now',
      'Oldest waiting hours',
      'Requested at',
      'Decided at',
    ],
    rows: [
      ...report.kinds.map((row): CsvCell[] => [
        'Summary',
        APPROVAL_WORDS[row.kind],
        null,
        null,
        row.decided,
        row.medianHours,
        row.slowestHours,
        row.waiting,
        row.oldestWaitingHours,
        null,
        null,
      ]),
      ...report.byDecider.map((row): CsvCell[] => [
        'Decided by',
        APPROVAL_WORDS[row.kind],
        row.decider.fullName,
        null,
        row.decided,
        row.medianHours,
        row.slowestHours,
        null,
        null,
        null,
        null,
      ]),
      ...report.slowest.map((row): CsvCell[] => [
        'Slowest',
        APPROVAL_WORDS[row.kind],
        row.title,
        row.context,
        1,
        row.hours,
        row.hours,
        null,
        null,
        localInstant(row.requestedAt, timeZone),
        localInstant(row.decidedAt, timeZone),
      ]),
    ],
  };
}
