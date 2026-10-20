import type { TemplateDetail, TemplateVersion } from '@lintel/api-contracts';
import {
  PROJECT_ROLE_LABELS,
  PROJECT_ROLES,
  type ProjectRole,
  TASK_PRIORITIES,
} from '@lintel/domain';

export type WorkflowDefinition = TemplateVersion['definition'];
export type TemplateStage = WorkflowDefinition['stages'][number];
export type TemplateTask = TemplateStage['tasks'][number];
export type TemplateMilestone = TemplateStage['milestones'][number];
export type TemplateOption = WorkflowDefinition['options'][number];
export type TaskPriority = TemplateTask['priority'];

export const ROLE_OPTIONS = PROJECT_ROLES.map((role) => ({
  value: role,
  label: PROJECT_ROLE_LABELS[role],
}));

export function roleLabel(role: ProjectRole): string {
  return PROJECT_ROLE_LABELS[role];
}

export const PRIORITY_LABELS: Readonly<Record<TaskPriority, string>> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

export const PRIORITY_OPTIONS = TASK_PRIORITIES.map((priority) => ({
  value: priority,
  label: PRIORITY_LABELS[priority],
}));

/** The version being edited: the draft if there is one, otherwise the published one. */
export function editableVersion(detail: TemplateDetail): TemplateVersion | undefined {
  return (
    detail.versions.find((version) => version.status === 'draft') ??
    detail.versions.find((version) => version.status === 'published')
  );
}

export function draftOf(detail: TemplateDetail): TemplateVersion | undefined {
  return detail.versions.find((version) => version.status === 'draft');
}

/** Every task in the workflow with where it sits. */
export function allTasks(definition: WorkflowDefinition) {
  return definition.stages.flatMap((stage, stageIndex) =>
    stage.tasks.map((task, taskIndex) => ({ task, stage, stageIndex, taskIndex })),
  );
}
