import { toCalendarDate } from '@lintel/shared';
import { describe, expect, it } from 'vitest';
import { DEFAULT_WORKING_CALENDAR } from '../calendar/working-calendar';
import { PROJECT_TYPES } from '../projects/project-status';
import { ProjectWorkflowPlanBuilder } from './project-workflow-plan.builder';
import { createWorkflowTemplatePreset } from './workflow-template.factory';
import { validateWorkflowTemplate } from './workflow-template.validator';
import type { WorkflowTemplateDefinition } from './workflow-template-definition';

const monday = toCalendarDate('2026-11-02');

describe('workflow template presets', () => {
  it.each(PROJECT_TYPES)('produces a valid %s template', (projectType) => {
    const preset = createWorkflowTemplatePreset(projectType);
    expect(validateWorkflowTemplate(preset.definition)).toEqual([]);
  });
});

describe('workflow template validation', () => {
  it('reports missing references and loops', () => {
    const broken: WorkflowTemplateDefinition = {
      options: [],
      stages: [
        {
          key: 'only',
          name: 'Only',
          milestones: [],
          tasks: [
            {
              key: 'a',
              title: 'A',
              responsibleRole: 'designer',
              durationDays: 1,
              dependsOn: ['b'],
              priority: 'low',
              requiresReview: false,
              checklist: [],
              deliverables: [],
              milestoneKey: 'ghost',
            },
            {
              key: 'b',
              title: 'B',
              responsibleRole: 'designer',
              durationDays: 0,
              dependsOn: ['a', 'missing'],
              priority: 'low',
              requiresReview: true,
              checklist: [],
              deliverables: [],
            },
          ],
        },
      ],
    };
    const messages = validateWorkflowTemplate(broken).map((issue) => issue.message);
    expect(messages).toEqual(
      expect.arrayContaining([
        'Milestone "ghost" does not exist.',
        'Dependency "missing" does not exist.',
        'Duration must be at least one day.',
        'Reviewed tasks need a reviewer role.',
        'Task dependencies form a loop.',
      ]),
    );
  });
});

describe('project workflow plan builder', () => {
  const preset = createWorkflowTemplatePreset('residential_interior');

  it('leaves out optional stages unless the option is chosen', () => {
    const designOnly = new ProjectWorkflowPlanBuilder(
      preset.definition,
      DEFAULT_WORKING_CALENDAR,
      monday,
    ).build();
    const withExecution = new ProjectWorkflowPlanBuilder(
      preset.definition,
      DEFAULT_WORKING_CALENDAR,
      monday,
    )
      .withOption('includes_execution')
      .build();
    expect(designOnly.stages.map((stage) => stage.template.key)).not.toContain('execution');
    expect(withExecution.stages.map((stage) => stage.template.key)).toContain('execution');
    expect(withExecution.plannedEndDate > designOnly.plannedEndDate).toBe(true);
  });

  it('starts tasks after their prerequisites, on working days', () => {
    const plan = new ProjectWorkflowPlanBuilder(preset.definition, DEFAULT_WORKING_CALENDAR, monday)
      .assignRole('designer', 'user-designer')
      .build();
    const byKey = new Map(plan.tasks.map((task) => [task.template.key, task]));
    const brief = byKey.get('client-brief');
    const spacePlanning = byKey.get('space-planning');
    expect(brief?.plannedStartDate).toBe('2026-11-02');
    expect(brief?.dueDate).toBe('2026-11-03');
    expect(brief?.ownerUserId).toBe('user-designer');
    expect(spacePlanning && brief && spacePlanning.plannedStartDate > brief.dueDate).toBe(true);
    // Four working days from Wednesday skip Sunday.
    expect(spacePlanning?.plannedStartDate).toBe('2026-11-04');
    expect(spacePlanning?.dueDate).toBe('2026-11-07');
  });

  it('dates milestones at the latest linked task', () => {
    const plan = new ProjectWorkflowPlanBuilder(
      preset.definition,
      DEFAULT_WORKING_CALENDAR,
      monday,
    ).build();
    const concept = plan.milestones.find(
      (milestone) => milestone.template.key === 'concept-approval',
    );
    const presentation = plan.tasks.find((task) => task.template.key === 'concept-presentation');
    expect(concept?.dueDate).toBe(presentation?.dueDate);
  });
});
