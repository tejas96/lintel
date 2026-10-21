import { describe, expect, it } from 'vitest';
import {
  type LeaveTypeDefinition,
  leaveTypeCodeFor,
  validateLeaveTypeDefinition,
  validateSecondApprovalThreshold,
} from './leave-type.rules';

const casual: LeaveTypeDefinition = {
  name: 'Casual leave',
  description: null,
  requiresReason: false,
  allowsHalfDay: true,
  minimumNoticeDays: 2,
  annualAllowanceHalfDays: 24,
  colorIndex: 0,
};

describe('leave type rules', () => {
  it('accepts a sensible type, with or without an allowance', () => {
    expect(validateLeaveTypeDefinition(casual)).toEqual([]);
    expect(validateLeaveTypeDefinition({ ...casual, annualAllowanceHalfDays: null })).toEqual([]);
  });

  it('explains every problem against its field', () => {
    const problems = validateLeaveTypeDefinition({
      ...casual,
      name: ' x ',
      minimumNoticeDays: -1,
      annualAllowanceHalfDays: 0,
      colorIndex: 9,
    });
    expect(problems.map((problem) => problem.field)).toEqual([
      'name',
      'minimumNoticeDays',
      'annualAllowanceHalfDays',
      'colorIndex',
    ]);
  });

  it('keeps the allowance in whole days when half days are not allowed', () => {
    const problems = validateLeaveTypeDefinition({
      ...casual,
      allowsHalfDay: false,
      annualAllowanceHalfDays: 25,
    });
    expect(problems).toEqual([
      {
        field: 'annualAllowanceHalfDays',
        message: 'This type has no half days, so the allowance must be whole days.',
      },
    ]);
  });

  it('limits notice to three months and the allowance to a year', () => {
    const problems = validateLeaveTypeDefinition({
      ...casual,
      minimumNoticeDays: 91,
      annualAllowanceHalfDays: 731,
    });
    expect(problems.map((problem) => problem.field)).toEqual([
      'minimumNoticeDays',
      'annualAllowanceHalfDays',
    ]);
  });

  it('checks the second-approval threshold', () => {
    expect(validateSecondApprovalThreshold(10)).toBeNull();
    expect(validateSecondApprovalThreshold(0)).toMatch(/from 1 to 120/);
    expect(validateSecondApprovalThreshold(2.5)).toMatch(/whole number/);
  });

  it('derives unique codes from names', () => {
    expect(leaveTypeCodeFor('Work from home', new Set())).toBe('work_from_home');
    expect(leaveTypeCodeFor('Casual', new Set(['casual', 'casual_2']))).toBe('casual_3');
    expect(leaveTypeCodeFor('—', new Set())).toBe('leave');
  });
});
