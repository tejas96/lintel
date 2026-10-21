import { toCalendarDate } from '@lintel/shared';
import { describe, expect, it } from 'vitest';
import { DEFAULT_WORKING_CALENDAR } from '../calendar/working-calendar';
import { NO_TAILORING, type PlanTailoring, tailorDefinition, tailoredPins } from './plan-tailoring';
import { validatePlanTailoring } from './plan-tailoring.validator';
import { ProjectWorkflowPlanBuilder } from './project-workflow-plan.builder';
import type { TemplateTask, WorkflowTemplateDefinition } from './workflow-template-definition';

const monday = toCalendarDate('2026-11-02');

function task(key: string, dependsOn: string[] = [], durationDays = 2): TemplateTask {
  return {
    key,
    title: key.toUpperCase(),
    responsibleRole: 'designer',
    durationDays,
    dependsOn,
    priority: 'medium',
    requiresReview: false,
    checklist: [],
    deliverables: [],
  };
}

const template: WorkflowTemplateDefinition = {
  options: [],
  stages: [
    {
      key: 'brief',
      name: 'Brief',
      milestones: [],
      tasks: [task('measure'), task('brief', ['measure'])],
    },
    { key: 'concept', name: 'Concept', milestones: [], tasks: [task('moodboard', ['brief'], 3)] },
    { key: 'drawings', name: 'Drawings', milestones: [], tasks: [task('plans', ['moodboard'])] },
  ],
};

function tailoring(overrides: Partial<PlanTailoring>): PlanTailoring {
  return { ...NO_TAILORING, ...overrides };
}

function build(changes: PlanTailoring) {
  const builder = new ProjectWorkflowPlanBuilder(
    tailorDefinition(template, changes),
    DEFAULT_WORKING_CALENDAR,
    monday,
  ).assignRole('designer', 'user-designer');
  const pins = tailoredPins(changes);
  for (const [key, date] of pins.startDates) builder.pinStart(key, date);
  for (const [key, owner] of pins.owners) builder.assignTask(key, owner);
  return builder.build();
}

describe('tailoring a plan before the project starts', () => {
  it('leaves the template as it is when nothing changes', () => {
    expect(tailorDefinition(template, NO_TAILORING)).toBe(template);
  });

  it('removes a stage with its tasks and lets later work start sooner', () => {
    const plan = build(tailoring({ removedStageKeys: ['concept'] }));
    expect(plan.stages.map((stage) => stage.template.key)).toEqual(['brief', 'drawings']);
    // "plans" waited on the removed moodboard, so it starts on day one.
    expect(plan.tasks.find((t) => t.template.key === 'plans')?.plannedStartDate).toBe(monday);
  });

  it('adds a stage and a task that waits on existing work', () => {
    const plan = build(
      tailoring({
        addedStages: [{ key: 'added-site', name: 'Site visit', afterStageKey: 'brief' }],
        addedTasks: [
          {
            key: 'added-visit',
            stageKey: 'added-site',
            title: 'Visit the site',
            durationDays: 1,
            dependsOn: ['brief'],
            priority: 'high',
            responsibleRole: 'site_supervisor',
          },
        ],
      }),
    );
    expect(plan.stages.map((stage) => stage.template.key)).toEqual([
      'brief',
      'added-site',
      'concept',
      'drawings',
    ]);
    const visit = plan.tasks.find((t) => t.template.key === 'added-visit');
    // measure runs Mon–Tue, brief Wed–Thu 5 Nov; the visit is the next working day.
    expect(visit).toMatchObject({ plannedStartDate: '2026-11-06', dueDate: '2026-11-06' });
  });

  it('moves the end date when a duration changes and keeps a chosen start', () => {
    const base = build(NO_TAILORING);
    const longer = build(tailoring({ adjustments: [{ taskKey: 'moodboard', durationDays: 6 }] }));
    expect(longer.plannedEndDate > base.plannedEndDate).toBe(true);
    const pinned = build(
      tailoring({ adjustments: [{ taskKey: 'plans', startDate: toCalendarDate('2026-11-23') }] }),
    );
    const plans = pinned.tasks.find((t) => t.template.key === 'plans');
    expect(plans).toMatchObject({ plannedStartDate: '2026-11-23', startPinned: true });
    expect(plans?.overlapsPrerequisite).toBe(false);
  });

  it('flags a chosen start that overlaps a prerequisite', () => {
    const plan = build(tailoring({ adjustments: [{ taskKey: 'brief', startDate: monday }] }));
    expect(plan.tasks.find((t) => t.template.key === 'brief')?.overlapsPrerequisite).toBe(true);
  });

  it('gives one task to a chosen person, or to nobody', () => {
    const plan = build(
      tailoring({
        adjustments: [
          { taskKey: 'measure', ownerUserId: 'user-site' },
          { taskKey: 'brief', ownerUserId: null },
        ],
      }),
    );
    const owner = (key: string) => plan.tasks.find((t) => t.template.key === key)?.ownerUserId;
    expect([owner('measure'), owner('brief'), owner('plans')]).toEqual([
      'user-site',
      null,
      'user-designer',
    ]);
  });

  it('dates an empty added stage where the previous stage ends', () => {
    const plan = build(
      tailoring({
        addedStages: [{ key: 'added-empty', name: 'Handover', afterStageKey: 'drawings' }],
      }),
    );
    const last = plan.stages.at(-1);
    expect(last?.template.key).toBe('added-empty');
    expect(last?.plannedStartDate).toBe(plan.stages.at(-2)?.plannedEndDate);
  });
});

describe('tailoring validation', () => {
  it('refuses unknown keys, waits on removed tasks and loops', () => {
    expect(
      validatePlanTailoring(template, tailoring({ removedTaskKeys: ['ghost'] }), monday),
    ).toEqual([{ path: 'removedTaskKeys.0', message: 'This task is not in the template.' }]);
    const waitsOnRemoved = validatePlanTailoring(
      template,
      tailoring({
        removedTaskKeys: ['brief'],
        addedTasks: [
          {
            key: 'added-a',
            stageKey: 'brief',
            title: 'Check',
            durationDays: 1,
            dependsOn: ['brief'],
            priority: 'low',
            responsibleRole: 'member',
          },
        ],
      }),
      monday,
    );
    expect(waitsOnRemoved.map((issue) => issue.path)).toEqual(['addedTasks.0.dependsOn.0']);
    const loop = validatePlanTailoring(
      template,
      tailoring({
        addedTasks: [
          {
            key: 'x',
            stageKey: 'brief',
            title: 'Xray',
            durationDays: 1,
            dependsOn: ['y'],
            priority: 'low',
            responsibleRole: 'member',
          },
          {
            key: 'y',
            stageKey: 'brief',
            title: 'Yoke',
            durationDays: 1,
            dependsOn: ['x'],
            priority: 'low',
            responsibleRole: 'member',
          },
        ],
      }),
      monday,
    );
    expect(loop.map((issue) => issue.path)).toEqual(['addedTasks']);
  });

  it('refuses impossible durations, early starts and an empty plan', () => {
    const issues = validatePlanTailoring(
      template,
      tailoring({
        adjustments: [
          { taskKey: 'measure', durationDays: 0 },
          { taskKey: 'brief', startDate: toCalendarDate('2026-10-30') },
        ],
      }),
      monday,
    );
    expect(issues.map((issue) => issue.path)).toEqual([
      'adjustments.0.durationDays',
      'adjustments.1.startDate',
    ]);
    expect(
      validatePlanTailoring(
        template,
        tailoring({ removedStageKeys: ['brief', 'concept', 'drawings'] }),
        monday,
      ),
    ).toEqual([{ path: 'removedStageKeys', message: 'Keep or add at least one stage.' }]);
  });
});
