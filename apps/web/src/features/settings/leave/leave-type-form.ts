import type { ManagedLeaveType } from '@lintel/api-contracts';
import { LEAVE_TYPE_LIMITS, type LeaveTypeDefinition } from '@lintel/domain';
import type { LeaveTypeChanges } from './use-leave-policies';

/** The leave type form as typed: days stay text until the person is done. */
export interface LeaveTypeFormValues {
  readonly name: string;
  readonly description: string;
  readonly colorIndex: number;
  readonly requiresReason: boolean;
  readonly allowsHalfDay: boolean;
  readonly minimumNoticeDays: string;
  readonly tracksAllowance: boolean;
  readonly allowanceDays: string;
}

const daysText = (halfDays: number) => String(halfDays / 2);

export function emptyLeaveType(colorIndex: number): LeaveTypeFormValues {
  return {
    name: '',
    description: '',
    colorIndex,
    requiresReason: false,
    allowsHalfDay: true,
    minimumNoticeDays: '0',
    tracksAllowance: true,
    allowanceDays: '12',
  };
}

export function leaveTypeValuesOf(type: ManagedLeaveType): LeaveTypeFormValues {
  return {
    name: type.name,
    description: type.description ?? '',
    colorIndex: type.colorIndex,
    requiresReason: type.requiresReason,
    allowsHalfDay: type.allowsHalfDay,
    minimumNoticeDays: String(type.minimumNoticeDays),
    tracksAllowance: type.annualAllowanceHalfDays !== null,
    allowanceDays:
      type.annualAllowanceHalfDays === null ? '12' : daysText(type.annualAllowanceHalfDays),
  };
}

const numberOf = (text: string) => Number(text.trim().replace(',', '.'));

export function definitionOf(values: LeaveTypeFormValues): LeaveTypeDefinition {
  const description = values.description.trim();
  return {
    name: values.name.trim(),
    description: description === '' ? null : description,
    colorIndex: values.colorIndex,
    requiresReason: values.requiresReason,
    allowsHalfDay: values.allowsHalfDay,
    minimumNoticeDays: numberOf(values.minimumNoticeDays),
    annualAllowanceHalfDays: values.tracksAllowance
      ? Math.round(numberOf(values.allowanceDays) * 2)
      : null,
  };
}

/** Only the fields that changed, so a save never overwrites someone else's edit by accident. */
export function leaveTypeChangesOf(
  type: ManagedLeaveType,
  values: LeaveTypeFormValues,
): LeaveTypeChanges {
  const next = definitionOf(values);
  const keys = Object.keys(next) as (keyof LeaveTypeDefinition)[];
  return Object.fromEntries(
    keys.filter((key) => next[key] !== type[key]).map((key) => [key, next[key]]),
  );
}

/** Quick checks before sending; the server applies the same rules and words them the same way. */
export function checkLeaveType(values: LeaveTypeFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  const limits = LEAVE_TYPE_LIMITS;
  const name = values.name.trim();
  if (name.length < limits.nameMinLength) errors.name = 'Give the leave type a name.';
  const notice = numberOf(values.minimumNoticeDays);
  if (!Number.isInteger(notice) || notice < 0 || notice > limits.maximumNoticeDays) {
    errors.minimumNoticeDays = `Use a whole number of days from 0 to ${limits.maximumNoticeDays}.`;
  }
  if (values.tracksAllowance) {
    const days = numberOf(values.allowanceDays);
    const halfDays = days * 2;
    if (!Number.isInteger(halfDays) || halfDays < 1 || halfDays > limits.maximumAllowanceHalfDays) {
      errors.annualAllowanceHalfDays = `Use whole or half days, up to ${limits.maximumAllowanceHalfDays / 2} a year.`;
    } else if (!values.allowsHalfDay && !Number.isInteger(days)) {
      errors.annualAllowanceHalfDays = 'Without half days, the allowance must be whole days.';
    }
  }
  return errors;
}
