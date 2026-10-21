import type {
  DelayKindView,
  DelaySummaryView,
  DelaysReport,
  EstimatesReport,
  EstimateTallyView,
  ReworkReport,
  ReworkTallyView,
} from '@lintel/api-contracts';
import type { CsvCell } from './csv-encoder';
import { type CsvTable, hours, localInstant, percent } from './report-csv';

const estimateCells = (tally: EstimateTallyView): CsvCell[] => [
  tally.measured,
  hours(tally.estimatedMinutes),
  hours(tally.loggedMinutes),
  percent(tally.effortRatio),
  percent(tally.withinRate),
  tally.within,
  tally.over,
  tally.under,
  percent(tally.medianRatio),
  tally.notMeasured,
  tally.withoutEstimate,
];

export function estimatesCsv(report: EstimatesReport): CsvTable {
  return {
    header: [
      'Group',
      'Name',
      'Detail',
      'Measured tasks',
      'Estimated hours',
      'Logged hours',
      'Logged ÷ estimated %',
      'Within estimate %',
      'Within 80–120 %',
      'Over 120 %',
      'Under 80 %',
      'Median task ratio %',
      'Estimated, no time logged',
      'Without an estimate',
    ],
    rows: [
      ['Total', 'All finished tasks in this report', null, ...estimateCells(report.totals)],
      ...report.byPerson.map((row): CsvCell[] => [
        'Person',
        row.user.fullName,
        row.team,
        ...estimateCells(row),
      ]),
      ...report.byTaskType.map((row): CsvCell[] => [
        'Task type',
        row.name,
        row.template,
        ...estimateCells(row),
      ]),
      ...report.byTemplate.map((row): CsvCell[] => [
        'Template',
        row.template?.name ?? 'No template',
        null,
        ...estimateCells(row),
      ]),
      ...report.byPeriod.map((row): CsvCell[] => [
        'Period',
        `${row.start} to ${row.end}`,
        null,
        ...estimateCells(row),
      ]),
    ],
  };
}

const reworkCells = (tally: ReworkTallyView): CsvCell[] => [
  tally.reviewed,
  tally.approved,
  tally.changesRequested,
  tally.rejected,
  tally.sentBack,
  percent(tally.reworkRate),
];

export function reworkCsv(report: ReworkReport): CsvTable {
  return {
    header: [
      'Group',
      'Name',
      'Detail',
      'Reviewed',
      'Approved',
      'Changes requested',
      'Rejected',
      'Sent back',
      'Rework rate %',
    ],
    rows: [
      ['Total', 'All reviews in this report', null, ...reworkCells(report.totals)],
      ...report.byProject.map((row): CsvCell[] => [
        'Project',
        row.project.name,
        row.project.reference,
        ...reworkCells(row),
      ]),
      ...report.byPerson.map((row): CsvCell[] => [
        'Submitted by',
        row.user.fullName,
        row.team,
        ...reworkCells(row),
      ]),
      ...report.mostSentBack.map((row): CsvCell[] => [
        row.kind === 'task' ? 'Task' : 'Deliverable',
        row.title,
        row.context,
        ...reworkCells(row),
      ]),
      ...report.byPeriod.map((row): CsvCell[] => [
        'Period',
        `${row.start} to ${row.end}`,
        null,
        ...reworkCells(row),
      ]),
    ],
  };
}

const DELAY_WORDS: Readonly<Record<DelayKindView, string>> = {
  client_signoff: 'Client sign-off',
  client_wait: 'Waiting on the client',
  internal_review: 'Internal review',
};

const delayCells = (summary: DelaySummaryView): CsvCell[] => [
  summary.count,
  summary.delayed,
  summary.medianHours,
  summary.slowestHours,
  summary.waitingNow,
  summary.oldestWaitingHours,
];

type DelayGroupRow = Pick<DelaysReport['byClient'][number], 'total' | 'kinds' | 'recurring'>;

/** A group's total row (with the recurring flag), then one row per kind it has. */
function groupRows(
  group: string,
  name: string,
  detail: string | null,
  row: DelayGroupRow,
): CsvCell[][] {
  return [
    [
      group,
      name,
      detail,
      'All',
      ...delayCells(row.total),
      row.recurring ? 'Yes' : 'No',
      null,
      null,
    ],
    ...row.kinds.map((kind): CsvCell[] => [
      group,
      name,
      detail,
      DELAY_WORDS[kind.kind],
      ...delayCells(kind),
      null,
      null,
      null,
    ]),
  ];
}

export function delaysCsv(report: DelaysReport, timeZone: string): CsvTable {
  return {
    header: [
      'Group',
      'Name',
      'Detail',
      'Approval',
      'Count',
      `Delayed (over ${report.delayedAfterHours} h)`,
      'Median hours',
      'Slowest hours',
      'Waiting now',
      'Oldest waiting hours',
      'Recurring',
      'Ready at',
      'Resolved at',
    ],
    rows: [
      ...report.kinds.map((row): CsvCell[] => [
        'Summary',
        'All clients in this report',
        null,
        DELAY_WORDS[row.kind],
        ...delayCells(row),
        null,
        null,
        null,
      ]),
      ...report.byClient.flatMap((row) =>
        groupRows(
          'Client',
          row.client,
          row.projects === 1 ? '1 project' : `${row.projects} projects`,
          row,
        ),
      ),
      ...report.byProject.flatMap((row) =>
        groupRows('Project', row.project.name, `${row.project.reference} · ${row.client}`, row),
      ),
      ...report.slowest.map((row): CsvCell[] => [
        'Slowest',
        row.title,
        row.context,
        DELAY_WORDS[row.kind],
        1,
        row.delayed ? 1 : 0,
        row.hours,
        row.hours,
        null,
        null,
        null,
        localInstant(row.readyAt, timeZone),
        localInstant(row.resolvedAt, timeZone),
      ]),
    ],
  };
}
