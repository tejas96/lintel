import { type CalendarDate, daysBetween, pluralize } from '@lintel/shared';

export interface LeaveTypeRules {
  readonly requiresReason: boolean;
  readonly allowsHalfDay: boolean;
  readonly minimumNoticeDays: number;
  /** Half-day units per year; null when the studio does not track a balance. */
  readonly annualAllowanceHalfDays: number | null;
}

export interface LeaveApprovalFacts {
  readonly today: CalendarDate;
  readonly startDate: CalendarDate;
  readonly requestedHalfDays: number;
  readonly usedHalfDaysThisYear: number;
  readonly reason: string | null;
  readonly isHalfDay: boolean;
  readonly isUrgentAbsence: boolean;
  readonly overlapsExistingRequest: boolean;
  readonly hasCriticalConflicts: boolean;
}

export interface LeaveApprovalAssessment {
  /** Problems that stop the request from being submitted. */
  readonly blockingProblems: readonly string[];
  /** Points the approver should see; they never block the request. */
  readonly warnings: readonly string[];
  /** 1 = the person's manager; 2 = the manager and then the owner or an administrator. */
  readonly approvalLevels: 1 | 2;
}

/** A replaceable leave policy (Strategy pattern); thresholds come from settings. */
export interface LeaveApprovalPolicy {
  assess(rules: LeaveTypeRules, facts: LeaveApprovalFacts): LeaveApprovalAssessment;
}

export interface StandardLeavePolicySettings {
  /** Requests longer than this many half-day units need a second approval. */
  readonly secondApprovalAboveHalfDays: number;
}

function blockingProblemsFor(rules: LeaveTypeRules, facts: LeaveApprovalFacts): string[] {
  const problems: string[] = [];
  if (facts.overlapsExistingRequest) {
    problems.push('These dates overlap another leave request of yours.');
  }
  if (rules.requiresReason && (facts.reason ?? '').trim().length < 3) {
    problems.push('This leave type needs a reason.');
  }
  if (facts.isHalfDay && !rules.allowsHalfDay) {
    problems.push('This leave type cannot be taken as a half day.');
  }
  return problems;
}

function warningsFor(rules: LeaveTypeRules, facts: LeaveApprovalFacts): string[] {
  const warnings: string[] = [];
  const notice = daysBetween(facts.today, facts.startDate);
  if (!facts.isUrgentAbsence && notice < rules.minimumNoticeDays) {
    warnings.push(`Less than ${pluralize(rules.minimumNoticeDays, 'day')} of notice was given.`);
  }
  if (rules.annualAllowanceHalfDays !== null) {
    const remaining = rules.annualAllowanceHalfDays - facts.usedHalfDaysThisYear;
    if (facts.requestedHalfDays > remaining) {
      warnings.push(`This exceeds the remaining allowance of ${pluralize(remaining / 2, 'day')}.`);
    }
  }
  if (facts.hasCriticalConflicts) {
    warnings.push('Critical work is due during this leave. Plan a handover.');
  }
  return warnings;
}

export function createStandardLeaveApprovalPolicy(
  settings: StandardLeavePolicySettings,
): LeaveApprovalPolicy {
  return {
    assess(rules, facts) {
      const longLeave = facts.requestedHalfDays > settings.secondApprovalAboveHalfDays;
      return {
        blockingProblems: blockingProblemsFor(rules, facts),
        warnings: warningsFor(rules, facts),
        approvalLevels: longLeave || facts.hasCriticalConflicts ? 2 : 1,
      };
    },
  };
}
