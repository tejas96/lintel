import type { LeaveTypeRules } from './leave-approval.policy';

/** What a studio decides about one kind of leave. Nothing statutory is assumed. */
export interface LeaveTypeDefinition extends LeaveTypeRules {
  readonly name: string;
  readonly description: string | null;
  /** Index into the six project swatches, so a type keeps its colour everywhere. */
  readonly colorIndex: number;
}

export const LEAVE_TYPE_LIMITS = {
  nameMinLength: 2,
  nameMaxLength: 60,
  descriptionMaxLength: 300,
  /** Notice is only ever a warning; three months covers every studio policy we know. */
  maximumNoticeDays: 90,
  /** One year of working days, in half-day units. */
  maximumAllowanceHalfDays: 730,
  colorCount: 6,
} as const;

/** Requests longer than this many half-days need a second approval (studio setting). */
export const SECOND_APPROVAL_THRESHOLD_LIMITS = { minimum: 1, maximum: 120 } as const;

export interface LeaveTypeProblem {
  readonly field: keyof LeaveTypeDefinition;
  readonly message: string;
}

function isWholeNumberBetween(value: number, minimum: number, maximum: number): boolean {
  return Number.isInteger(value) && value >= minimum && value <= maximum;
}

/** Every problem with a leave type, worded for the person filling in the form. */
export function validateLeaveTypeDefinition(definition: LeaveTypeDefinition): LeaveTypeProblem[] {
  const limits = LEAVE_TYPE_LIMITS;
  const problems: LeaveTypeProblem[] = [];
  const name = definition.name.trim();
  if (name.length < limits.nameMinLength || name.length > limits.nameMaxLength) {
    problems.push({
      field: 'name',
      message: `Use ${limits.nameMinLength} to ${limits.nameMaxLength} characters.`,
    });
  }
  if ((definition.description ?? '').length > limits.descriptionMaxLength) {
    problems.push({
      field: 'description',
      message: `Keep the description under ${limits.descriptionMaxLength} characters.`,
    });
  }
  if (!isWholeNumberBetween(definition.minimumNoticeDays, 0, limits.maximumNoticeDays)) {
    problems.push({
      field: 'minimumNoticeDays',
      message: `Use a whole number of days from 0 to ${limits.maximumNoticeDays}.`,
    });
  }
  const allowance = definition.annualAllowanceHalfDays;
  if (allowance !== null && !isWholeNumberBetween(allowance, 1, limits.maximumAllowanceHalfDays)) {
    problems.push({
      field: 'annualAllowanceHalfDays',
      message: `Use whole or half days, up to ${limits.maximumAllowanceHalfDays / 2} a year.`,
    });
  }
  if (allowance !== null && !definition.allowsHalfDay && allowance % 2 !== 0) {
    problems.push({
      field: 'annualAllowanceHalfDays',
      message: 'This type has no half days, so the allowance must be whole days.',
    });
  }
  if (!isWholeNumberBetween(definition.colorIndex, 0, limits.colorCount - 1)) {
    problems.push({ field: 'colorIndex', message: 'Choose one of the colours.' });
  }
  return problems;
}

export function validateSecondApprovalThreshold(halfDays: number): string | null {
  const { minimum, maximum } = SECOND_APPROVAL_THRESHOLD_LIMITS;
  return isWholeNumberBetween(halfDays, minimum, maximum)
    ? null
    : `Use a whole number of half-days from ${minimum} to ${maximum}.`;
}

/**
 * A stable machine code from the name ("Work from home" → "work_from_home"),
 * made unique against codes already taken ("…_2", "…_3").
 */
export function leaveTypeCodeFor(name: string, taken: ReadonlySet<string>): string {
  const base =
    name
      .normalize('NFKD')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'leave';
  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base}_${suffix}`)) suffix += 1;
  return `${base}_${suffix}`;
}
