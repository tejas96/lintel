import type { DemoPersonKey } from './demo-projects';

export type DemoLeaveCode = 'casual' | 'sick' | 'earned' | 'unpaid';

export interface DemoLeavePlan {
  readonly person: DemoPersonKey;
  readonly type: DemoLeaveCode;
  /** Working days from today to the first day off; negative is in the past. */
  readonly startInWorkingDays: number;
  readonly workingDays: number;
  /** Half days are single days only. */
  readonly portion: 'full' | 'first_half' | 'second_half';
  readonly reason: string;
  /** Calendar days between asking and the first day off. */
  readonly noticeDays: number;
  /** For upcoming leave: asked this many days ago instead. */
  readonly requestedDaysAgo: number | null;
  /** Hours until the manager decided (or the requester withdrew). */
  readonly decisionHours: number;
  readonly outcome: 'approved' | 'rejected' | 'cancelled' | 'pending';
  readonly note: string | null;
}

/** person, type, first day (working days from today), length (days or a half), reason, notice days, hours to decide, note. */
type ApprovedRow = readonly [
  DemoPersonKey,
  DemoLeaveCode,
  number,
  number | 'first_half' | 'second_half',
  string,
  number,
  number,
  string,
];

const APPROVED_PAST: readonly ApprovedRow[] = [
  ['pm1', 'earned', -118, 3, 'Family trip to Coorg', 9, 20, 'Approved. Have a good trip.'],
  ['pm1', 'casual', -52, 'first_half', 'Personal errand', 3, 4, 'Approved.'],
  ['pm2', 'casual', -96, 2, 'Cousin’s wedding in Indore', 6, 26, 'Approved. Congratulations!'],
  ['pm2', 'sick', -33, 1, 'Medical appointment', 2, 3, 'Approved. Take care.'],
  ['lead', 'earned', -105, 4, 'Annual family holiday', 10, 48, 'Approved. Reviews are covered.'],
  ['lead', 'casual', -61, 1, 'Moving house', 4, 6, 'Approved.'],
  ['designer1', 'casual', -82, 2, 'Sister’s graduation', 5, 2.5, 'Approved. Enjoy the day.'],
  ['designer1', 'sick', -27, 'second_half', 'Dental appointment', 2, 2, 'Approved.'],
  ['designer2', 'earned', -116, 5, 'Trip to Ladakh', 10, 52, 'Approved. Enjoy the mountains.'],
  ['designer2', 'casual', -44, 1, 'Personal work', 3, 7, 'Approved.'],
  ['designer3', 'casual', -70, 3, 'Friend’s wedding in Kochi', 8, 30, 'Approved.'],
  ['designer3', 'unpaid', -38, 2, 'Extended family visit', 5, 9, 'Approved as unpaid leave.'],
  ['architect', 'earned', -92, 4, 'Family holiday', 9, 28, 'Approved. Have a restful break.'],
  ['architect', 'sick', -12, 1, 'Medical check-up', 2, 2, 'Approved. Feel better.'],
  ['site', 'casual', -100, 2, 'Village festival', 7, 5, 'Approved.'],
  ['site', 'casual', -58, 'first_half', 'Vehicle service', 2, 3, 'Approved.'],
  ['site', 'sick', -21, 1, 'Medical appointment', 2, 4, 'Approved. Take care.'],
];

function fromRow([
  person,
  type,
  start,
  length,
  reason,
  notice,
  hours,
  note,
]: ApprovedRow): DemoLeavePlan {
  return {
    person,
    type,
    startInWorkingDays: start,
    workingDays: typeof length === 'number' ? length : 1,
    portion: typeof length === 'number' ? 'full' : length,
    reason,
    noticeDays: notice,
    requestedDaysAgo: null,
    decisionHours: hours,
    outcome: 'approved',
    note,
  };
}

const SPECIAL_CASES: readonly DemoLeavePlan[] = [
  {
    person: 'designer2',
    type: 'casual',
    startInWorkingDays: -16,
    workingDays: 2,
    portion: 'full',
    reason: 'Short break',
    noticeDays: 6,
    requestedDaysAgo: null,
    decisionHours: 5,
    outcome: 'rejected',
    note: 'Sorry, the café design freeze is that week. Could you take the week after instead?',
  },
  {
    person: 'architect',
    type: 'casual',
    startInWorkingDays: -50,
    workingDays: 1,
    portion: 'full',
    reason: 'Personal work',
    noticeDays: 6,
    requestedDaysAgo: null,
    decisionHours: 40,
    outcome: 'cancelled',
    note: 'No longer needed. Plans changed.',
  },
  {
    person: 'designer1',
    type: 'earned',
    startInWorkingDays: 14,
    workingDays: 3,
    portion: 'full',
    reason: 'Travel with family',
    noticeDays: 0,
    requestedDaysAgo: 4,
    decisionHours: 22,
    outcome: 'approved',
    note: 'Approved. Plan the handover before you go.',
  },
  {
    person: 'site',
    type: 'casual',
    startInWorkingDays: 17,
    workingDays: 1,
    portion: 'full',
    reason: 'Family function',
    noticeDays: 0,
    requestedDaysAgo: 3,
    decisionHours: 6,
    outcome: 'approved',
    note: 'Approved.',
  },
  {
    person: 'lead',
    type: 'casual',
    startInWorkingDays: 9,
    workingDays: 2,
    portion: 'full',
    reason: 'Visiting family',
    noticeDays: 0,
    requestedDaysAgo: 2,
    decisionHours: 0,
    outcome: 'pending',
    note: null,
  },
];

/**
 * About five months of leave for eight people, mostly approved by the
 * person's manager within hours to days, plus one rejection, one withdrawal,
 * two approved upcoming breaks and one request still waiting. Every request
 * is five days or fewer (one approval level) and gives the notice its leave
 * type asks for. Reasons are short and deliberately ordinary.
 */
export const DEMO_LEAVE_HISTORY: readonly DemoLeavePlan[] = [
  ...APPROVED_PAST.map(fromRow),
  ...SPECIAL_CASES,
];
