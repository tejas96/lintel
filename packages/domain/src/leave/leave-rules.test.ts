import { toCalendarDate } from '@lintel/shared';
import { describe, expect, it } from 'vitest';
import { DEFAULT_WORKING_CALENDAR } from '../calendar/working-calendar';
import {
  createStandardLeaveApprovalPolicy,
  type LeaveApprovalFacts,
} from './leave-approval.policy';
import { detectLeaveConflicts, type LeaveTaskFact } from './leave-conflict.detector';
import { leaveDays, totalHalfDayUnits, validateLeavePeriod } from './leave-request';

const date = toCalendarDate;

describe('leave periods', () => {
  it('counts only working days and supports half days', () => {
    const days = leaveDays(
      { startDate: date('2026-11-06'), endDate: date('2026-11-09'), dayPortion: 'full' },
      DEFAULT_WORKING_CALENDAR,
    );
    expect(days.map((day) => day.date)).toEqual(['2026-11-06', '2026-11-07', '2026-11-09']);
    expect(totalHalfDayUnits(days)).toBe(6);
    const half = leaveDays(
      { startDate: date('2026-11-06'), endDate: date('2026-11-06'), dayPortion: 'first_half' },
      DEFAULT_WORKING_CALENDAR,
    );
    expect(totalHalfDayUnits(half)).toBe(1);
  });

  it('rejects reversed dates and multi-day half days', () => {
    const problems = validateLeavePeriod({
      startDate: date('2026-11-09'),
      endDate: date('2026-11-06'),
      dayPortion: 'second_half',
    });
    expect(problems.map((problem) => problem.field)).toEqual(['endDate', 'dayPortion']);
  });
});

describe('leave conflicts', () => {
  const task: LeaveTaskFact = {
    taskId: 't1',
    title: 'Working drawings',
    projectId: 'p1',
    projectName: 'Saska residence',
    projectCriticality: 'normal',
    status: 'in_progress',
    priority: 'medium',
    plannedStartDate: date('2026-11-02'),
    dueDate: date('2026-11-10'),
    milestoneName: null,
    milestoneDueDate: null,
  };
  const days = [{ date: date('2026-11-05'), halfDayUnits: 2 as const }];

  it('warns about work scheduled during the leave', () => {
    const report = detectLeaveConflicts(days, [task], []);
    expect(report.taskConflicts[0]?.kind).toBe('work_during_leave');
    expect(report.hasCritical).toBe(false);
  });

  it('marks milestones and urgent deadlines as critical', () => {
    const report = detectLeaveConflicts(
      days,
      [
        { ...task, taskId: 't2', priority: 'urgent', dueDate: date('2026-11-05') },
        {
          ...task,
          taskId: 't3',
          milestoneName: 'Design freeze',
          milestoneDueDate: date('2026-11-05'),
        },
        { ...task, taskId: 't4', status: 'done' },
      ],
      [{ userId: 'u2', fullName: 'Ravi', status: 'approved', dates: [date('2026-11-05')] }],
    );
    expect(report.hasCritical).toBe(true);
    expect(report.taskConflicts).toHaveLength(2);
    expect(report.overlappingAbsences[0]?.fullName).toBe('Ravi');
  });
});

describe('standard leave approval policy', () => {
  const policy = createStandardLeaveApprovalPolicy({ secondApprovalAboveHalfDays: 10 });
  const rules = {
    requiresReason: true,
    allowsHalfDay: true,
    minimumNoticeDays: 3,
    annualAllowanceHalfDays: 24,
  };
  const facts: LeaveApprovalFacts = {
    today: date('2026-10-21'),
    startDate: date('2026-11-02'),
    requestedHalfDays: 4,
    usedHalfDaysThisYear: 0,
    reason: 'Family wedding',
    isHalfDay: false,
    isUrgentAbsence: false,
    overlapsExistingRequest: false,
    hasCriticalConflicts: false,
  };

  it('accepts a normal request with one approval level', () => {
    expect(policy.assess(rules, facts)).toEqual({
      blockingProblems: [],
      warnings: [],
      approvalLevels: 1,
    });
  });

  it('blocks overlaps and missing reasons but only warns about short notice', () => {
    const result = policy.assess(rules, {
      ...facts,
      overlapsExistingRequest: true,
      reason: '',
      startDate: date('2026-10-22'),
    });
    expect(result.blockingProblems).toHaveLength(2);
    expect(result.warnings[0]).toContain('notice');
  });

  it('needs a second approval for long leave or critical conflicts', () => {
    expect(policy.assess(rules, { ...facts, requestedHalfDays: 12 }).approvalLevels).toBe(2);
    expect(policy.assess(rules, { ...facts, hasCriticalConflicts: true }).approvalLevels).toBe(2);
  });
});
