import { type CalendarDate, maxCalendarDate, minCalendarDate } from '@lintel/shared';
import { type WorkingCalendar, workingDaysInRange } from '../calendar/working-calendar';
import { PROJECT_ROLE_LABELS, type ProjectRole } from '../identity/roles';

export interface CoverWindow {
  readonly start: CalendarDate;
  readonly end: CalendarDate;
}

/**
 * The days someone else would carry the task: from the later of the leave's
 * start, today and the task's planned start, to the earlier of the leave's
 * end and the task's due date. Work already overdue needs cover from the
 * first day of the absence (or today).
 */
export function coverWindow(
  task: { readonly plannedStartDate: CalendarDate | null; readonly dueDate: CalendarDate | null },
  leave: CoverWindow,
  today: CalendarDate,
): CoverWindow {
  const from = maxCalendarDate(leave.start, today);
  const start = task.plannedStartDate ? maxCalendarDate(from, task.plannedStartDate) : from;
  const end = task.dueDate ? minCalendarDate(leave.end, task.dueDate) : leave.end;
  return end < start ? { start: from, end: from } : { start, end };
}

/**
 * The effort that falls in the cover window: remaining effort spread evenly
 * over the owner's working days from today (or the planned start) to the due
 * date, as capacity spreads it, counted on the window's days. Work with
 * nothing planned in the window (overdue, or due before it) counts whole.
 */
export function coverNeedMinutes(
  remainingMinutes: number,
  task: { readonly plannedStartDate: CalendarDate | null; readonly dueDate: CalendarDate | null },
  window: CoverWindow,
  calendar: WorkingCalendar,
  today: CalendarDate,
): number {
  const from =
    task.plannedStartDate && task.plannedStartDate > today ? task.plannedStartDate : today;
  const to = task.dueDate && task.dueDate >= from ? task.dueDate : from;
  const days = workingDaysInRange(calendar, from, to);
  const inWindow = days.filter((day) => day >= window.start && day <= window.end).length;
  if (days.length === 0 || inWindow === 0) return remainingMinutes;
  return Math.round((remainingMinutes * inWindow) / days.length);
}

export interface CoverTaskFact {
  readonly reviewerUserId: string | null;
  /** The task's effort that falls in the cover window (coverNeedMinutes). */
  readonly needMinutes: number;
}

export interface CoverPersonFact {
  readonly userId: string;
  readonly designation: string | null;
  /** Their role on the task's project; null when they are not a member. */
  readonly projectRole: ProjectRole | null;
}

export interface CoverCandidateFact extends CoverPersonFact {
  /** Available minus confirmed work in the window (can be negative). */
  readonly freeMinutes: number;
  readonly availableMinutes: number;
  /** Any approved or pending leave in the window. */
  readonly awayInWindow: boolean;
}

export interface CoverSuggestion {
  readonly userId: string;
  readonly score: number;
  readonly freeMinutes: number;
  /** Has at least the task's remaining effort free in the window. */
  readonly hasRoom: boolean;
  readonly reasons: readonly string[];
}

/** Points per signal (strategy "cover-v1", documented in docs/PRODUCT_REQUIREMENTS.md §15.5). */
export const COVER_POINTS = {
  sameProjectRole: 40,
  projectMember: 20,
  sameDesignation: 25,
  room: 30,
} as const;

export const COVER_SUGGESTION_LIMIT = 3;

const hours = (minutes: number) => `${Math.round((Math.max(0, minutes) / 60) * 10) / 10} h`;
const sameText = (left: string | null, right: string | null) =>
  left !== null && right !== null && left.trim().toLowerCase() === right.trim().toLowerCase();

/**
 * A different specialist role on the project (a site supervisor for a
 * designer's task, the project manager for a drafter's) is not a fit by
 * itself; plain team members and people with the same role are.
 */
export function isUnrelatedProjectRole(
  candidate: ProjectRole | null,
  absent: ProjectRole | null,
): boolean {
  if (candidate === null || candidate === absent) return false;
  return candidate !== 'member' && absent !== null && absent !== 'member';
}

function fitOf(
  candidate: CoverPersonFact,
  absent: CoverPersonFact,
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  const sameDesignation = sameText(candidate.designation, absent.designation);
  if (candidate.projectRole !== null && candidate.projectRole === absent.projectRole) {
    score += COVER_POINTS.sameProjectRole;
    reasons.push(`${PROJECT_ROLE_LABELS[candidate.projectRole]} on this project`);
  } else if (candidate.projectRole !== null) {
    if (isUnrelatedProjectRole(candidate.projectRole, absent.projectRole) && !sameDesignation) {
      return { score: 0, reasons: [] };
    }
    score += COVER_POINTS.projectMember;
    reasons.push('On this project');
  }
  if (sameDesignation) {
    score += COVER_POINTS.sameDesignation;
    reasons.push(`Also ${candidate.designation?.trim().toLowerCase() ?? ''}`);
  }
  return { score, reasons };
}

function roomReason(freeMinutes: number, need: number): string {
  if (freeMinutes >= need) return `${hours(freeMinutes)} free in those days`;
  if (freeMinutes > 0)
    return `Only ${hours(freeMinutes)} free; the task needs about ${hours(need)} then`;
  return 'Fully booked in those days';
}

/**
 * Who could take a task while its owner is away. Only people who fit the work
 * are considered: the same role on this project, a member of the project in
 * a related role (see isUnrelatedProjectRole), or the same designation as the
 * absent owner. People away in those days, people
 * with no working time in them, the absent owner and the task's reviewer are
 * left out. People with any free time come before fully booked ones, then
 * by points, then by free time. Nobody is ever assigned by this: a manager
 * chooses.
 */
export function suggestCover(
  task: CoverTaskFact,
  absent: CoverPersonFact,
  candidates: readonly CoverCandidateFact[],
): CoverSuggestion[] {
  const need = Math.max(1, task.needMinutes);
  const suggestions: CoverSuggestion[] = [];
  for (const candidate of candidates) {
    if (candidate.userId === absent.userId || candidate.userId === task.reviewerUserId) continue;
    if (candidate.awayInWindow || candidate.availableMinutes <= 0) continue;
    const fit = fitOf(candidate, absent);
    if (fit.score === 0) continue;
    const room = Math.max(0, Math.min(1, candidate.freeMinutes / need));
    suggestions.push({
      userId: candidate.userId,
      score: fit.score + Math.round(COVER_POINTS.room * room),
      freeMinutes: candidate.freeMinutes,
      hasRoom: candidate.freeMinutes >= need,
      reasons: [...fit.reasons, roomReason(candidate.freeMinutes, need)],
    });
  }
  return suggestions
    .sort(
      (left, right) =>
        Number(right.freeMinutes > 0) - Number(left.freeMinutes > 0) ||
        right.score - left.score ||
        right.freeMinutes - left.freeMinutes,
    )
    .slice(0, COVER_SUGGESTION_LIMIT);
}
