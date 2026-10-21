import { nextWorkingDayOnOrAfter, type ProjectCostCategory } from '@lintel/domain';
import { addDays, daysBetween, minCalendarDate, toCalendarDate } from '@lintel/shared';
import type { Database } from '../../client';
import { projectCostEntries } from '../../schema';
import type { HistoryProject } from './demo-history-projects';
import { type HistoryClock, plusHours } from './demo-history-time';

/** Share of the budget spent so far and how many ledger lines make it up. */
const COST_PLANS: Readonly<Record<string, { share: number; entries: number }>> = {
  'Kiln & Co. Café': { share: 1.04, entries: 9 },
  'Banyan Court Villa': { share: 0.9, entries: 6 },
  'Fernhill Courtyard Home': { share: 0.76, entries: 10 },
  'Tamarind Studio Pavilion': { share: 0.72, entries: 7 },
  'Marigold Loft': { share: 0.55, entries: 8 },
  'Saska Residence': { share: 0.38, entries: 5 },
  'Tidewater Offices': { share: 0.27, entries: 4 },
};
const DEFAULT_PLAN = { share: 0.4, entries: 5 };
/** The project whose ledger also holds one voided duplicate. */
const PROJECT_WITH_VOIDED_ENTRY = 'Kiln & Co. Café';

/** In date order; the first four cover every category. Weights split the spend. */
const LEDGER_LINES: readonly { category: ProjectCostCategory; weight: number; note: string }[] = [
  { category: 'consultant', weight: 3, note: 'Structural consultant fee' },
  { category: 'material', weight: 6, note: 'Plywood, laminates and hardware' },
  { category: 'site', weight: 5, note: 'Civil and carpentry labour' },
  { category: 'other', weight: 1, note: 'Printing, courier and site travel' },
  { category: 'consultant', weight: 2, note: 'Services (MEP) consultant' },
  { category: 'material', weight: 4, note: 'Lighting fixtures and cabling' },
  { category: 'site', weight: 3, note: 'Painting and polishing crew' },
  { category: 'material', weight: 3, note: 'Stone and tiles' },
  { category: 'other', weight: 1, note: 'Client presentation boards' },
  { category: 'site', weight: 2, note: 'Cleaning and debris removal' },
];

/** "Kiln & Co. Café" → "KCC", for obviously made-up invoice numbers. */
function invoicePrefix(name: string): string {
  return name
    .split(/\s+/)
    .map((word) => word.replace(/[^A-Za-z]/g, '').charAt(0))
    .join('')
    .toUpperCase();
}

/** Whole-rupee amounts (in paise) that add up exactly to the target. */
function splitAmount(totalMinor: number, weights: readonly number[]): number[] {
  const sum = weights.reduce((total, weight) => total + weight, 0);
  const amounts = weights.map((weight) => Math.floor((totalMinor * weight) / sum / 1_000) * 1_000);
  const rest = totalMinor - amounts.reduce((total, amount) => total + amount, 0);
  const last = amounts.length - 1;
  amounts[last] = (amounts[last] ?? 0) + rest;
  return amounts;
}

type NewCostEntry = typeof projectCostEntries.$inferInsert;

function ledgerFor(project: HistoryProject, clock: HistoryClock): NewCostEntry[] {
  const plan = COST_PLANS[project.name] ?? DEFAULT_PLAN;
  if (!project.budgetMinor || project.plannedStartDate >= clock.today) return [];
  const start = toCalendarDate(project.plannedStartDate);
  const end = minCalendarDate(toCalendarDate(project.plannedEndDate), addDays(clock.today, -1));
  const span = Math.max(0, daysBetween(start, end));
  const lines = LEDGER_LINES.slice(0, plan.entries);
  const amounts = splitAmount(
    Math.round(project.budgetMinor * plan.share),
    lines.map((line) => line.weight),
  );
  const prefix = invoicePrefix(project.name);
  return lines.map((line, index) => {
    const spaced = addDays(start, Math.round(((index + 0.5) * span) / lines.length));
    const entryDate = minCalendarDate(nextWorkingDayOnOrAfter(clock.calendar, spaced), end);
    const recordedAt = clock.past(clock.at(entryDate, '18:10'));
    return {
      projectId: project.id,
      entryDate,
      category: line.category,
      amountMinor: amounts[index] ?? 0,
      currency: 'INR',
      note: `${line.note} (invoice ${prefix}-${1040 + index * 37})`,
      recordedByUserId: project.managerUserId,
      createdAt: recordedAt,
      updatedAt: recordedAt,
    };
  });
}

/** The same invoice entered twice, then voided by the manager the next day. */
function voidedDuplicate(entry: NewCostEntry, clock: HistoryClock): NewCostEntry {
  const recordedAt = clock.past(plusHours(entry.createdAt ?? clock.now, 1));
  const voidedAt = clock.past(plusHours(recordedAt, 26));
  const invoice = /invoice ([A-Z]+-\d+)/.exec(entry.note ?? '')?.[1] ?? 'on file';
  return {
    ...entry,
    voidedAt,
    voidedByUserId: entry.recordedByUserId,
    voidReason: `Duplicate of invoice ${invoice}`,
    version: 2,
    createdAt: recordedAt,
    updatedAt: voidedAt,
  };
}

/**
 * A cost ledger for every demo project that has started, in INR paise: one
 * slightly over budget, one on a thin margin, the finished projects healthy
 * and the rest part-way through. Voided entries never count toward spend.
 */
export async function seedCostLedger(
  db: Database,
  clock: HistoryClock,
  scope: readonly HistoryProject[],
): Promise<{ entries: number; voided: number }> {
  let entries = 0;
  let voided = 0;
  for (const project of scope) {
    const ledger = ledgerFor(project, clock);
    if (ledger.length === 0) continue;
    const duplicateOf = ledger[1];
    if (project.name === PROJECT_WITH_VOIDED_ENTRY && duplicateOf) {
      ledger.push(voidedDuplicate(duplicateOf, clock));
      voided += 1;
    }
    await db.insert(projectCostEntries).values(ledger);
    entries += ledger.length;
  }
  return { entries, voided };
}
