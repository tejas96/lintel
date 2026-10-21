import { DEFAULT_WORKING_CALENDAR } from '../calendar/working-calendar';
import type {
  TemplateTask,
  WorkflowTemplateDefinition,
} from '../workflows/workflow-template-definition';
import type { ProjectWorkflowSnapshot, SnapshotTask } from './template-update.types';

/** Test fixtures: a two-stage template, a newer version of it, and a project running on the old one. */
export function templateTask(
  key: string,
  title: string,
  extra: Partial<TemplateTask> = {},
): TemplateTask {
  return {
    key,
    title,
    responsibleRole: 'designer',
    durationDays: 2,
    dependsOn: [],
    priority: 'medium',
    requiresReview: false,
    checklist: [],
    deliverables: [],
    ...extra,
  };
}

export const OLD_VERSION: WorkflowTemplateDefinition = {
  options: [],
  stages: [
    {
      key: 'concept',
      name: 'Concept',
      milestones: [{ key: 'concept-ok', name: 'Concept approved', requiresClientApproval: true }],
      tasks: [
        templateTask('brief', 'Capture the brief', { milestoneKey: 'concept-ok' }),
        templateTask('moodboard', 'Mood board', { dependsOn: ['brief'], durationDays: 3 }),
      ],
    },
    {
      key: 'design',
      name: 'Design',
      milestones: [],
      tasks: [
        templateTask('drawings', 'Working drawings', {
          checklist: [{ label: 'Plans', required: true }],
        }),
        templateTask('specs', 'Specifications'),
        templateTask('lighting', 'Lighting plan'),
        templateTask('review-pack', 'Review pack'),
        templateTask('handover', 'Handover note'),
      ],
    },
  ],
};

export const NEW_VERSION: WorkflowTemplateDefinition = {
  options: [],
  stages: [
    {
      key: 'kickoff',
      name: 'Kick-off',
      milestones: [],
      tasks: [templateTask('welcome', 'Welcome call')],
    },
    {
      key: 'concept',
      name: 'Concept',
      milestones: [{ key: 'concept-ok', name: 'Concept signed off', requiresClientApproval: true }],
      tasks: [
        templateTask('brief', 'Capture the client brief', { milestoneKey: 'concept-ok' }),
        templateTask('moodboard', 'Mood board', { dependsOn: ['brief'], durationDays: 5 }),
        templateTask('site-photos', 'Site photographs', { dependsOn: ['brief'], durationDays: 1 }),
      ],
    },
    {
      key: 'design',
      name: 'Design development',
      milestones: [],
      tasks: [
        templateTask('drawings', 'Detailed drawings', {
          checklist: [
            { label: 'Plans', required: true },
            { label: 'Check ceiling heights', required: true },
          ],
        }),
        templateTask('handover', 'Handover note', { priority: 'high' }),
      ],
    },
    {
      key: 'procurement',
      name: 'Procurement',
      milestones: [{ key: 'orders-placed', name: 'Orders placed', requiresClientApproval: false }],
      tasks: [templateTask('orders', 'Place orders', { dependsOn: ['drawings'] })],
    },
  ],
};

function task(
  id: string,
  templateKey: string,
  title: string,
  extra: Partial<SnapshotTask> = {},
): SnapshotTask {
  return {
    id,
    templateKey,
    parentTaskId: null,
    stageId: 'stage-design',
    milestoneId: null,
    title,
    description: null,
    status: 'ready',
    priority: 'medium',
    requiresReview: false,
    estimateMinutes: null,
    escalateAfterOverdueDays: 1,
    plannedStartDate: '2026-11-02',
    dueDate: '2026-11-03',
    baselineDueDate: '2026-11-03',
    checklistLabels: [],
    deliverableNames: [],
    prerequisiteTaskIds: [],
    ...extra,
  };
}

/** Concept is under way; design has not started. Drawings were renamed in this project. */
export const PROJECT: ProjectWorkflowSnapshot = {
  templateOptions: [],
  stages: [
    {
      id: 'stage-concept',
      templateKey: 'concept',
      name: 'Concept',
      description: null,
      status: 'active',
      position: 0,
    },
    {
      id: 'stage-design',
      templateKey: 'design',
      name: 'Design',
      description: null,
      status: 'pending',
      position: 1,
    },
  ],
  milestones: [
    {
      id: 'ms-concept',
      templateKey: 'concept-ok',
      stageId: 'stage-concept',
      name: 'Concept approved',
      status: 'pending',
      requiresClientApproval: true,
    },
  ],
  tasks: [
    task('t-brief', 'brief', 'Capture the brief', {
      stageId: 'stage-concept',
      milestoneId: 'ms-concept',
      status: 'in_progress',
      plannedStartDate: '2026-10-26',
      dueDate: '2026-10-27',
      baselineDueDate: '2026-10-27',
    }),
    task('t-mood', 'moodboard', 'Mood board', {
      stageId: 'stage-concept',
      plannedStartDate: '2026-10-28',
      dueDate: '2026-10-30',
      baselineDueDate: '2026-10-30',
      prerequisiteTaskIds: ['t-brief'],
    }),
    task('t-drawings', 'drawings', 'Drawings for the joiner', { checklistLabels: ['Plans'] }),
    task('t-specs', 'specs', 'Specifications'),
    task('t-lighting', 'lighting', 'Lighting plan', { status: 'in_progress' }),
    task('t-review', 'review-pack', 'Review pack', { status: 'in_review' }),
    task('t-handover', 'handover', 'Handover note', { status: 'done' }),
  ],
};

export const UPDATE_INPUT = {
  project: PROJECT,
  from: OLD_VERSION,
  to: NEW_VERSION,
  calendar: DEFAULT_WORKING_CALENDAR,
};
