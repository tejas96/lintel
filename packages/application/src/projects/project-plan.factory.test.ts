import {
  DEFAULT_WORKING_CALENDAR,
  NO_TAILORING,
  type TemplateTask,
  type WorkflowTemplateDefinition,
} from '@lintel/domain';
import { toCalendarDate } from '@lintel/shared';
import { describe, expect, it } from 'vitest';
import { normalizeMembers } from './project-members.rules';
import { buildWorkflowPlan, planFromTemplate, singleStagePlan } from './project-plan.factory';

function templateTask(key: string, overrides: Partial<TemplateTask> = {}): TemplateTask {
  return {
    key,
    title: key,
    responsibleRole: 'designer',
    durationDays: 2,
    dependsOn: [],
    priority: 'medium',
    requiresReview: false,
    checklist: [],
    deliverables: [],
    ...overrides,
  };
}

const definition: WorkflowTemplateDefinition = {
  options: [{ key: 'includes_execution', label: 'Execution', enabledByDefault: false }],
  stages: [
    {
      key: 'design',
      name: 'Design',
      milestones: [{ key: 'signoff', name: 'Sign-off', requiresClientApproval: true }],
      tasks: [
        templateTask('brief', {
          milestoneKey: 'signoff',
          checklist: [{ label: 'Budget agreed', required: true }],
          deliverables: [{ name: 'Brief', required: true }],
          subtasks: [{ title: 'Call client' }, { title: 'Visit site', estimateMinutes: 90 }],
        }),
        templateTask('layout', {
          dependsOn: ['brief'],
          requiresReview: true,
          reviewerRole: 'manager',
          responsibleRole: 'architect',
          deliverables: [{ name: 'Layout', required: true }],
        }),
      ],
    },
    {
      key: 'site',
      name: 'Site work',
      requiresOptions: ['includes_execution'],
      milestones: [],
      tasks: [
        templateTask('install', { dependsOn: ['layout'], responsibleRole: 'site_supervisor' }),
      ],
    },
  ],
};

const members = normalizeMembers('pm', [{ userId: 'dee', projectRole: 'designer' }]);
const startDate = toCalendarDate('2026-10-21');

describe('project plan from a template', () => {
  it('numbers tasks in stage order, follows them with subtasks and dates them', () => {
    const plan = planFromTemplate(
      buildWorkflowPlan({
        definition,
        calendar: DEFAULT_WORKING_CALENDAR,
        startDate,
        options: [],
        members,
      }),
      'pm',
    );
    expect(plan.stages.map((stage) => [stage.key, stage.status])).toEqual([['design', 'active']]);
    expect(plan.tasks.map((task) => [task.number, task.key, task.parentKey])).toEqual([
      [1, 'brief', null],
      [2, 'brief#1', 'brief'],
      [3, 'brief#2', 'brief'],
      [4, 'layout', null],
    ]);
    const [brief, call, , layout] = plan.tasks;
    expect(brief).toMatchObject({
      dueDate: '2026-10-22',
      status: 'ready',
      milestoneKey: 'signoff',
    });
    expect(call).toMatchObject({ ownerUserId: 'dee', dueDate: '2026-10-22', milestoneKey: null });
    // Nobody holds the architect role, so the layout task waits as a draft.
    expect(layout).toMatchObject({ ownerUserId: null, status: 'draft', reviewerUserId: 'pm' });
    expect(layout?.dependsOn).toEqual(['brief']);
    expect(plan.milestones).toEqual([
      {
        key: 'signoff',
        stageKey: 'design',
        name: 'Sign-off',
        dueDate: '2026-10-22',
        requiresClientApproval: true,
        position: 0,
      },
    ]);
  });

  it('includes optional stages only when the option is chosen', () => {
    const plan = planFromTemplate(
      buildWorkflowPlan({
        definition,
        calendar: DEFAULT_WORKING_CALENDAR,
        startDate,
        options: ['includes_execution'],
        members: normalizeMembers('pm', [{ userId: 'sam', projectRole: 'site_supervisor' }]),
      }),
      'pm',
    );
    expect(plan.stages.map((stage) => stage.status)).toEqual(['active', 'pending']);
    const install = plan.tasks.find((task) => task.key === 'install');
    expect(install).toMatchObject({ ownerUserId: 'sam', stageKey: 'site', status: 'ready' });
  });

  it('gives deliverables the task reviewer, or the manager when there is none', () => {
    const plan = planFromTemplate(
      buildWorkflowPlan({
        definition,
        calendar: DEFAULT_WORKING_CALENDAR,
        startDate,
        options: [],
        members,
      }),
      'pm',
    );
    expect(plan.deliverables).toEqual([
      { taskKey: 'brief', name: 'Brief', isRequired: true, reviewerUserId: 'pm' },
      { taskKey: 'layout', name: 'Layout', isRequired: true, reviewerUserId: 'pm' },
    ]);
  });

  it('never makes the person given a task by hand its reviewer', () => {
    const workflow = buildWorkflowPlan({
      definition,
      calendar: DEFAULT_WORKING_CALENDAR,
      startDate,
      options: [],
      members,
      tailoring: { ...NO_TAILORING, adjustments: [{ taskKey: 'layout', ownerUserId: 'pm' }] },
    });
    const layout = workflow.tasks.find((task) => task.template.key === 'layout');
    expect(layout).toMatchObject({ ownerUserId: 'pm', reviewerUserId: null });
  });

  it('starts template-free projects with one active stage', () => {
    expect(singleStagePlan('2026-10-21').stages).toMatchObject([
      { name: 'Project', status: 'active' },
    ]);
  });
});

describe('project members', () => {
  it('always puts the manager first with the manager role', () => {
    expect(normalizeMembers('pm', [{ userId: 'dee', projectRole: 'designer' }])).toEqual([
      { userId: 'pm', projectRole: 'manager' },
      { userId: 'dee', projectRole: 'designer' },
    ]);
  });

  it('rejects duplicates and a second manager', () => {
    expect(() =>
      normalizeMembers('pm', [
        { userId: 'dee', projectRole: 'designer' },
        { userId: 'dee', projectRole: 'reviewer' },
        { userId: 'max', projectRole: 'manager' },
      ]),
    ).toThrow('Check the project team.');
  });
});
