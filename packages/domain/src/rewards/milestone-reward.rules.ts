import type { CalendarDate } from '@lintel/shared';
import { type WorkingCalendar, workingDaysBetween } from '../calendar/working-calendar';
import { DOCUMENT_FOLDER_LABELS, type DocumentFolder } from '../documents/document-rules';
import { type DelayBlockerFact, excusedWorkingDays } from './excused-delay';

/** planned → pending_review (at completion) → approved / rejected; withdrawn if removed first. */
export const MILESTONE_REWARD_STATUSES = [
  'planned',
  'pending_review',
  'approved',
  'rejected',
  'withdrawn',
] as const;
export type MilestoneRewardStatus = (typeof MILESTONE_REWARD_STATUSES)[number];

export const MILESTONE_REWARD_CHECKS = [
  'deliverables_submitted',
  'reviews_passed',
  'on_time',
  'documentation',
] as const;
export type MilestoneRewardCheck = (typeof MILESTONE_REWARD_CHECKS)[number];

export const MILESTONE_REWARD_CHECK_LABELS: Readonly<Record<MilestoneRewardCheck, string>> = {
  deliverables_submitted: 'Required deliverables submitted',
  reviews_passed: 'Reviews passed',
  on_time: 'Completed by the agreed date',
  documentation: 'Required documents on file',
};

/** Short names for the summary line. */
const CHECK_NOUNS: Readonly<Record<MilestoneRewardCheck, string>> = {
  deliverables_submitted: 'deliverables',
  reviews_passed: 'reviews',
  on_time: 'timing',
  documentation: 'documents',
};

/** A team reward is shared by 2 to 20 people; an individual one belongs to one person. */
export const MAX_SHARED_REWARD_RECIPIENTS = 20;

/** A deliverable of the milestone's work (tasks that were not cancelled). */
export interface MilestoneDeliverableFact {
  readonly name: string;
  readonly isRequired: boolean;
  /** At least one version was submitted. */
  readonly submitted: boolean;
  /** Its latest version was approved. */
  readonly approved: boolean;
}

/** Everything the rules look at for one recipient, built from stored records. */
export interface MilestoneRewardFacts {
  readonly recipientUserId: string;
  /** The milestone's due date when the reward was attached. */
  readonly agreedDueDate: CalendarDate;
  /** The due date at completion; it only moves when a scope change is approved. */
  readonly dueDate: CalendarDate;
  readonly completedOn: CalendarDate;
  readonly deliverables: readonly MilestoneDeliverableFact[];
  readonly requiredFolders: readonly DocumentFolder[];
  /** Folders holding at least one current document added by completion. */
  readonly foldersOnFile: ReadonlySet<DocumentFolder>;
  readonly blockers: readonly DelayBlockerFact[];
  /** The recipient's working calendar. */
  readonly calendar: WorkingCalendar;
}

/** One condition's result, in the same shape as a policy criterion's result. */
export interface MilestoneCheckResult {
  readonly type: MilestoneRewardCheck;
  readonly label: string;
  readonly passed: boolean;
  readonly actual: string;
  readonly required: string;
  readonly explanation: string;
}

export interface MilestoneRewardAssessment {
  /** grant = every condition met; withhold = at least one was not. A person decides either way. */
  readonly recommendation: 'grant' | 'withhold';
  readonly checks: readonly MilestoneCheckResult[];
  readonly summary: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "12 Nov 2026". */
export function formatRewardDate(date: CalendarDate): string {
  return `${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1] ?? ''} ${date.slice(0, 4)}`;
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

function listNames(names: readonly string[]): string {
  const shown = names.slice(0, 3).join(', ');
  return names.length > 3 ? `${shown} and ${names.length - 3} more` : shown;
}

function result(
  check: MilestoneRewardCheck,
  passed: boolean,
  actual: string,
  required: string,
  explanation: string,
): MilestoneCheckResult {
  return {
    type: check,
    label: MILESTONE_REWARD_CHECK_LABELS[check],
    passed,
    actual,
    required,
    explanation,
  };
}

function deliverablesCheck(facts: MilestoneRewardFacts): MilestoneCheckResult {
  const required = facts.deliverables.filter((item) => item.isRequired);
  const missing = required.filter((item) => !item.submitted).map((item) => item.name);
  const submitted = required.length - missing.length;
  return result(
    'deliverables_submitted',
    missing.length === 0,
    required.length === 0 ? 'None needed' : `${submitted} of ${required.length}`,
    required.length === 0 ? 'nothing' : 'all',
    required.length === 0
      ? 'No deliverables were required for this milestone.'
      : missing.length === 0
        ? required.length === 1
          ? 'The required deliverable was submitted.'
          : `All ${required.length} required deliverables were submitted.`
        : `Not submitted: ${listNames(missing)}.`,
  );
}

function reviewsCheck(facts: MilestoneRewardFacts): MilestoneCheckResult {
  const required = facts.deliverables.filter((item) => item.isRequired);
  const notApproved = required.filter((item) => !item.approved).map((item) => item.name);
  return result(
    'reviews_passed',
    notApproved.length === 0,
    required.length === 0
      ? 'None needed'
      : `${required.length - notApproved.length} of ${required.length}`,
    required.length === 0 ? 'nothing' : 'all approved',
    required.length === 0
      ? 'Nothing needed a review.'
      : notApproved.length === 0
        ? 'Every required deliverable was approved in review.'
        : `Not approved in review: ${listNames(notApproved)}.`,
  );
}

function onTimeCheck(facts: MilestoneRewardFacts): MilestoneCheckResult {
  const deadline = facts.dueDate;
  const revised = deadline !== facts.agreedDueDate;
  const by = revised
    ? `${formatRewardDate(deadline)} (moved from ${formatRewardDate(facts.agreedDueDate)} by an approved scope change)`
    : formatRewardDate(deadline);
  const late = Math.max(0, workingDaysBetween(facts.calendar, deadline, facts.completedOn));
  const excused = excusedWorkingDays(facts.blockers, facts.recipientUserId, facts.calendar);
  const required = `completion by ${formatRewardDate(deadline)}`;
  if (late === 0) {
    return result(
      'on_time',
      true,
      'On time',
      required,
      `Completed ${formatRewardDate(facts.completedOn)}, on or before ${by}.`,
    );
  }
  const passed = late <= excused;
  const waited = `The work waited ${plural(excused, 'working day')} on blockers outside their control (client, supplier, a decision or a colleague)`;
  return result(
    'on_time',
    passed,
    excused > 0 ? `${plural(late, 'day')} late, ${excused} excused` : `${plural(late, 'day')} late`,
    required,
    passed
      ? `Completed ${plural(late, 'working day')} after ${by}. ${waited}, so the delay does not count against them.`
      : excused > 0
        ? `Completed ${plural(late, 'working day')} after ${by}. ${waited}; that covers only part of the delay.`
        : `Completed ${plural(late, 'working day')} after ${by}, with no recorded blocker outside their control.`,
  );
}

function documentationCheck(facts: MilestoneRewardFacts): MilestoneCheckResult {
  const missing = facts.requiredFolders.filter((folder) => !facts.foldersOnFile.has(folder));
  const required = facts.requiredFolders.length;
  return result(
    'documentation',
    missing.length === 0,
    required === 0 ? 'None needed' : `${required - missing.length} of ${required}`,
    required === 0 ? 'nothing' : 'all on file',
    required === 0
      ? 'No documents were required.'
      : missing.length === 0
        ? `${listNames(facts.requiredFolders.map((folder) => DOCUMENT_FOLDER_LABELS[folder]))} on file.`
        : `Missing from the project documents: ${listNames(missing.map((folder) => DOCUMENT_FOLDER_LABELS[folder]))}.`,
  );
}

/**
 * Checks a completed milestone against its reward's conditions for one
 * recipient. The result is only a recommendation: a person with
 * `rewards.decide` approves or declines it, and nothing is ever deducted
 * automatically — the full share is proposed either way.
 */
export function assessMilestoneReward(facts: MilestoneRewardFacts): MilestoneRewardAssessment {
  const checks = [
    deliverablesCheck(facts),
    reviewsCheck(facts),
    onTimeCheck(facts),
    documentationCheck(facts),
  ];
  const failed = checks.filter((check) => !check.passed).map((check) => CHECK_NOUNS[check.type]);
  return {
    recommendation: failed.length === 0 ? 'grant' : 'withhold',
    checks,
    summary:
      failed.length === 0
        ? 'Every condition was met. A reviewer confirms the reward.'
        : `${failed.length} of ${checks.length} conditions not met (${failed.join(', ')}). A reviewer decides; nothing is deducted automatically.`,
  };
}
