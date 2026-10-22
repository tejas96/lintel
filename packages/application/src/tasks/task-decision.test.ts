import type { TaskActorRelation } from '@lintel/domain';
import { describe, expect, it } from 'vitest';
import { InMemoryOperationsWorld } from '../testing/in-memory-operations.world';
import type { TaskDecisionInputs, TaskRecord } from './task.store';
import {
  buildDecisionFacts,
  decideFor,
  transitionOptions,
  transitionRefusal,
} from './task-decision';

const owner: TaskActorRelation = {
  isTaskOwner: true,
  isCollaborator: false,
  isReviewer: false,
  canManage: false,
};
const outsider: TaskActorRelation = { ...owner, isTaskOwner: false };
const manager: TaskActorRelation = { ...outsider, canManage: true };

const noInputs: TaskDecisionInputs = {
  collaboratorUserIds: [],
  prerequisiteEdges: [],
  prerequisites: [],
  checklist: [],
  deliverables: [],
  openBlockerCount: 0,
};

function task(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return new InMemoryOperationsWorld().addTask({
    id: 'task-1',
    projectId: 'p1',
    title: 'Concept moodboard',
    ownerUserId: 'u-owner',
    ...overrides,
  });
}

const option = (options: ReturnType<typeof transitionOptions>, to: string) =>
  options.find((candidate) => candidate.to === to);

describe('transition facts → options', () => {
  it('explains which prerequisites keep a ready task from starting', () => {
    const facts = buildDecisionFacts(
      task(),
      {
        ...noInputs,
        prerequisiteEdges: [
          { taskId: 'task-1', dependsOnTaskId: 'measure' },
          { taskId: 'task-1', dependsOnTaskId: 'brief' },
        ],
        prerequisites: [
          { id: 'measure', title: 'Measure the site', status: 'in_progress' },
          { id: 'brief', title: 'Client brief', status: 'cancelled' },
        ],
      },
      owner,
    );
    expect(facts.unmetPrerequisiteTitles).toEqual(['Measure the site']);
    const start = option(transitionOptions(facts), 'in_progress');
    expect(start).toMatchObject({ label: 'Start work', allowed: false, requiresNote: false });
    expect(start?.reasons).toEqual(['Waiting on: Measure the site.']);
  });

  it('lists every missing piece before review: checklist and unsubmitted deliverables', () => {
    const facts = buildDecisionFacts(
      task({ status: 'in_progress', requiresReview: true, reviewerUserId: 'u-lead' }),
      {
        ...noInputs,
        checklist: [
          { isRequired: true, completed: false },
          { isRequired: false, completed: false },
          { isRequired: true, completed: true },
        ],
        deliverables: [
          {
            name: 'Moodboard PDF',
            isRequired: true,
            status: 'not_submitted',
            currentVersionNumber: 0,
          },
          {
            name: 'Sketches',
            isRequired: true,
            status: 'changes_requested',
            currentVersionNumber: 1,
          },
          {
            name: 'Optional render',
            isRequired: false,
            status: 'not_submitted',
            currentVersionNumber: 0,
          },
        ],
      },
      owner,
    );
    const options = transitionOptions(facts);
    expect(option(options, 'in_review')?.reasons).toEqual([
      '1 required checklist item is not done.',
      'Submit the required deliverables: Moodboard PDF.',
    ]);
    expect(option(options, 'done')?.reasons).toContain('Send this task for review instead.');
    expect(option(options, 'blocked')).toMatchObject({ allowed: true, requiresNote: true });
    expect(option(options, 'cancelled')?.reasons).toEqual(['Only a project manager can do this.']);
  });

  it('tells people outside the task why they cannot act, and lets managers cancel with a note', () => {
    const facts = buildDecisionFacts(task({ status: 'in_progress' }), noInputs, outsider);
    expect(option(transitionOptions(facts), 'blocked')?.reasons).toEqual([
      'Only the owner or a collaborator can do this.',
    ]);
    const managerFacts = buildDecisionFacts(task({ status: 'in_progress' }), noInputs, manager);
    expect(option(transitionOptions(managerFacts), 'cancelled')).toMatchObject({
      allowed: true,
      requiresNote: true,
      reasons: [],
    });
  });

  it('blocks resuming while a blocker is still open', () => {
    const facts = buildDecisionFacts(
      task({ status: 'blocked' }),
      { ...noInputs, openBlockerCount: 1 },
      owner,
    );
    expect(option(transitionOptions(facts), 'in_progress')).toMatchObject({
      label: 'Resume work',
      allowed: false,
      reasons: ['Resolve the open blockers before resuming work.'],
    });
  });
});

describe('transition refusals', () => {
  const facts = (relation: TaskActorRelation, overrides: Partial<TaskRecord> = {}) =>
    buildDecisionFacts(task(overrides), noInputs, relation);
  const refusal = (decision: ReturnType<typeof decideFor>) =>
    decision.allowed ? null : transitionRefusal(decision.violations).code;

  it('maps illegal moves, permissions, missing notes and unmet conditions to distinct codes', () => {
    expect(refusal(decideFor(facts(owner), 'done', null))).toBe('INVALID_TRANSITION');
    expect(refusal(decideFor(facts(owner), 'cancelled', 'Client paused'))).toBe('FORBIDDEN');
    expect(refusal(decideFor(facts(manager), 'cancelled', null))).toBe('VALIDATION_FAILED');
    expect(refusal(decideFor(facts(owner, { dueDate: null }), 'in_progress', null))).toBe(
      'PRECONDITION_FAILED',
    );
    expect(decideFor(facts(owner), 'in_progress', null).allowed).toBe(true);
  });
});
