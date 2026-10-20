import { describe, expect, it } from 'vitest';
import type { LeaveStepRecord } from './leave.store';
import { planApprovalSteps, resolveLeaveDecision } from './leave-approval-routing';

const directory = { ownerUserId: 'owner', delegateUserIds: ['admin', 'admin2'] };
const approvers = (steps: { approverUserId: string | null; status: string }[]) =>
  steps.map((step) => `${step.approverUserId ?? '—'}:${step.status}`);

describe('approval step routing', () => {
  it('routes level 1 to the manager and level 2 to the owner', () => {
    const steps = planApprovalSteps({ id: 'ana', activeManagerUserId: 'lead' }, 2, directory);
    expect(approvers(steps)).toEqual(['lead:pending', 'owner:waiting']);
  });

  it('uses only one level when the policy asks for one', () => {
    const steps = planApprovalSteps({ id: 'ana', activeManagerUserId: 'lead' }, 1, directory);
    expect(approvers(steps)).toEqual(['lead:pending']);
  });

  it('falls back to the owner when the person has no (active) manager', () => {
    const steps = planApprovalSteps({ id: 'ana', activeManagerUserId: null }, 1, directory);
    expect(approvers(steps)).toEqual(['owner:pending']);
  });

  it('sends level 2 to an administrator when the owner is the manager', () => {
    const steps = planApprovalSteps({ id: 'pm', activeManagerUserId: 'owner' }, 2, directory);
    expect(approvers(steps)).toEqual(['owner:pending', 'admin:waiting']);
  });

  it('never routes the owner their own request while a delegate exists', () => {
    const steps = planApprovalSteps({ id: 'owner', activeManagerUserId: null }, 2, directory);
    expect(approvers(steps)).toEqual(['admin:pending', 'admin2:waiting']);
  });

  it('skips level 2 when no distinct second approver exists', () => {
    const steps = planApprovalSteps({ id: 'owner', activeManagerUserId: null }, 2, {
      ownerUserId: 'owner',
      delegateUserIds: ['admin'],
    });
    expect(approvers(steps)).toEqual(['admin:pending', '—:skipped']);
  });
});

const chain = (first: LeaveStepRecord['status'], second: LeaveStepRecord['status']) => [
  { id: 's1', level: 1, approverUserId: 'lead', status: first },
  { id: 's2', level: 2, approverUserId: 'owner', status: second },
];

describe('leave decisions', () => {
  it('approving level 1 activates level 2 and keeps the request pending', () => {
    const outcome = resolveLeaveDecision('pending', chain('pending', 'waiting'), 'approve');
    expect(outcome.requestStatus).toBe('pending');
    expect(outcome.decidedStep?.id).toBe('s1');
    expect(outcome.activatedStep?.id).toBe('s2');
  });

  it('approving the last level approves the request', () => {
    const outcome = resolveLeaveDecision('pending', chain('approved', 'pending'), 'approve');
    expect(outcome.requestStatus).toBe('approved');
    expect(outcome.decidedStep?.id).toBe('s2');
    expect(outcome.activatedStep).toBeNull();
  });

  it('rejecting closes the remaining levels', () => {
    const outcome = resolveLeaveDecision('pending', chain('pending', 'waiting'), 'reject');
    expect(outcome.requestStatus).toBe('rejected');
    expect(outcome.decidedStepStatus).toBe('rejected');
    expect(outcome.skippedSteps.map((step) => step.id)).toEqual(['s2']);
  });

  it('asking for information pauses the request without deciding a step', () => {
    const outcome = resolveLeaveDecision('pending', chain('pending', 'waiting'), 'request_info');
    expect(outcome.requestStatus).toBe('info_requested');
    expect(outcome.decidedStep).toBeNull();
  });

  it('cannot approve while waiting for the requester, but can still reject', () => {
    expect(() =>
      resolveLeaveDecision('info_requested', chain('pending', 'waiting'), 'approve'),
    ).toThrow(expect.objectContaining({ code: 'INVALID_TRANSITION' }));
    expect(
      resolveLeaveDecision('info_requested', chain('pending', 'waiting'), 'reject').requestStatus,
    ).toBe('rejected');
  });

  it('refuses decisions on finished requests', () => {
    expect(() => resolveLeaveDecision('approved', chain('approved', 'approved'), 'reject')).toThrow(
      expect.objectContaining({ code: 'INVALID_TRANSITION' }),
    );
  });
});
