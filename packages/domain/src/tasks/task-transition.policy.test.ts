import { describe, expect, it } from 'vitest';
import { decideTaskTransition, type TaskTransitionContext } from './task-transition.policy';

const owner = { isTaskOwner: true, isCollaborator: false, isReviewer: false, canManage: false };
const reviewer = { isTaskOwner: false, isCollaborator: false, isReviewer: true, canManage: false };
const outsider = { isTaskOwner: false, isCollaborator: false, isReviewer: false, canManage: false };

function context(overrides: Partial<TaskTransitionContext>): TaskTransitionContext {
  return {
    from: 'ready',
    to: 'in_progress',
    actor: owner,
    hasOwner: true,
    hasDueDate: true,
    requiresReview: true,
    hasReviewer: true,
    unmetPrerequisiteTitles: [],
    incompleteRequiredChecklistItems: 0,
    missingRequiredDeliverables: [],
    hasOpenBlockers: false,
    note: null,
    ...overrides,
  };
}

function codes(decision: ReturnType<typeof decideTaskTransition>): string[] {
  return decision.allowed ? [] : decision.violations.map((violation) => violation.code);
}

describe('task transition policy', () => {
  it('lets the owner start a ready task', () => {
    expect(decideTaskTransition(context({})).allowed).toBe(true);
  });

  it('rejects moves that are not in the state machine', () => {
    expect(codes(decideTaskTransition(context({ from: 'draft', to: 'done' })))).toEqual([
      'ILLEGAL_TRANSITION',
    ]);
  });

  it('keeps people outside the task from changing it', () => {
    expect(codes(decideTaskTransition(context({ actor: outsider })))).toContain(
      'NOT_A_TASK_PARTICIPANT',
    );
  });

  it('waits for prerequisites before work starts', () => {
    const decision = decideTaskTransition(
      context({ unmetPrerequisiteTitles: ['Site measurement'] }),
    );
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.violations[0]?.message).toContain('Site measurement');
  });

  it('requires the checklist and deliverables before review', () => {
    const decision = decideTaskTransition(
      context({
        from: 'in_progress',
        to: 'in_review',
        incompleteRequiredChecklistItems: 2,
        missingRequiredDeliverables: ['Floor plan'],
      }),
    );
    expect(codes(decision)).toEqual(['CHECKLIST_INCOMPLETE', 'DELIVERABLES_MISSING']);
  });

  it('forces reviewed tasks through review instead of straight to done', () => {
    expect(codes(decideTaskTransition(context({ from: 'in_progress', to: 'done' })))).toContain(
      'REVIEW_REQUIRED',
    );
  });

  it('lets only the reviewer approve and requires a note for changes', () => {
    expect(
      decideTaskTransition(context({ from: 'in_review', to: 'done', actor: reviewer })).allowed,
    ).toBe(true);
    expect(codes(decideTaskTransition(context({ from: 'in_review', to: 'done' })))).toEqual([
      'REVIEWER_ONLY',
    ]);
    expect(
      codes(
        decideTaskTransition(
          context({ from: 'in_review', to: 'changes_requested', actor: reviewer }),
        ),
      ),
    ).toEqual(['NOTE_REQUIRED']);
  });

  it('requires blockers to be resolved before resuming', () => {
    expect(
      codes(
        decideTaskTransition(
          context({ from: 'blocked', to: 'in_progress', hasOpenBlockers: true }),
        ),
      ),
    ).toEqual(['BLOCKERS_OPEN']);
  });

  it('allows only managers to cancel, with a reason', () => {
    const manager = { ...outsider, canManage: true };
    expect(codes(decideTaskTransition(context({ to: 'cancelled' })))).toEqual([
      'MANAGER_ONLY',
      'NOTE_REQUIRED',
    ]);
    expect(
      decideTaskTransition(
        context({ to: 'cancelled', actor: manager, note: 'Client dropped scope' }),
      ).allowed,
    ).toBe(true);
  });
});
