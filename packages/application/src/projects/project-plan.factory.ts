import {
  NO_TAILORING,
  type PlannedTask,
  type PlanTailoring,
  type ProjectWorkflowPlan,
  ProjectWorkflowPlanBuilder,
  tailorDefinition,
  tailoredPins,
  validatePlanTailoring,
  type WorkflowTemplateDefinition,
  type WorkingCalendar,
} from '@lintel/domain';
import { type CalendarDate, ValidationFailedError } from '@lintel/shared';
import type { ProjectMemberInput } from './project.store';
import type {
  NewProjectPlan,
  PlannedProjectDeliverable,
  PlannedProjectTask,
} from './project-plan.types';

export interface WorkflowPlanRequest {
  readonly definition: WorkflowTemplateDefinition;
  readonly calendar: WorkingCalendar;
  readonly startDate: CalendarDate;
  readonly options: readonly string[];
  /** Members with their project roles; the manager is already among them. */
  readonly members: readonly ProjectMemberInput[];
  /** The project manager's changes to the template for this project. */
  readonly tailoring?: PlanTailoring;
}

/** Refuses a tailoring that does not fit the template, naming each field under `tailoring.`. */
export function assertValidTailoring(
  definition: WorkflowTemplateDefinition,
  tailoring: PlanTailoring,
  startDate: CalendarDate,
): void {
  const issues = validatePlanTailoring(definition, tailoring, startDate);
  if (issues.length === 0) return;
  throw new ValidationFailedError(
    'Some changes to the plan need attention.',
    issues.map((issue) => ({ field: `tailoring.${issue.path}`, message: issue.message })),
  );
}

/**
 * Dates the (tailored) template on the working calendar: each role goes to
 * the first member holding it, a task given to someone by hand goes to them,
 * and a chosen start date wins over the one worked out from prerequisites.
 * Call `assertValidTailoring` first.
 */
export function buildWorkflowPlan(request: WorkflowPlanRequest): ProjectWorkflowPlan {
  const tailoring = request.tailoring ?? NO_TAILORING;
  const builder = new ProjectWorkflowPlanBuilder(
    tailorDefinition(request.definition, tailoring),
    request.calendar,
    request.startDate,
  );
  for (const option of request.options) builder.withOption(option);
  const assigned = new Set<string>();
  for (const member of request.members) {
    if (assigned.has(member.projectRole)) continue;
    assigned.add(member.projectRole);
    builder.assignRole(member.projectRole, member.userId);
  }
  const pins = tailoredPins(tailoring);
  for (const [taskKey, date] of pins.startDates) builder.pinStart(taskKey, date);
  for (const [taskKey, userId] of pins.owners) builder.assignTask(taskKey, userId);
  return builder.build();
}

/** Keys the project manager added (they come from no template, so carry no template key). */
export function addedPlanKeys(tailoring: PlanTailoring | undefined): ReadonlySet<string> {
  if (!tailoring) return new Set();
  return new Set([
    ...tailoring.addedStages.map((stage) => stage.key),
    ...tailoring.addedTasks.map((task) => task.key),
  ]);
}

function readiness(ownerUserId: string | null, dueDate: string | null): 'ready' | 'draft' {
  return ownerUserId !== null && dueDate !== null ? 'ready' : 'draft';
}

function toTask(
  planned: PlannedTask,
  number: number,
  position: number,
  scope: {
    tasks: ReadonlySet<string>;
    milestones: ReadonlySet<string>;
    added: ReadonlySet<string>;
  },
): PlannedProjectTask {
  const template = planned.template;
  const milestoneKey =
    template.milestoneKey && scope.milestones.has(template.milestoneKey)
      ? template.milestoneKey
      : null;
  return {
    key: template.key,
    parentKey: null,
    stageKey: planned.stageKey,
    milestoneKey,
    templateKey: scope.added.has(template.key) ? null : template.key,
    number,
    title: template.title,
    description: template.description ?? null,
    status: readiness(planned.ownerUserId, planned.dueDate),
    priority: template.priority,
    ownerUserId: planned.ownerUserId,
    reviewerUserId: template.requiresReview ? planned.reviewerUserId : null,
    plannedStartDate: planned.plannedStartDate,
    dueDate: planned.dueDate,
    estimateMinutes: template.estimateMinutes ?? null,
    requiresReview: template.requiresReview,
    escalateAfterOverdueDays: template.escalateAfterOverdueDays ?? 1,
    position,
    checklist: template.checklist.map((item) => ({
      label: item.label,
      isRequired: item.required,
    })),
    dependsOn: template.dependsOn.filter((key) => scope.tasks.has(key)),
  };
}

function subtasksOf(
  parent: PlannedProjectTask,
  planned: PlannedTask,
  firstNumber: number,
): PlannedProjectTask[] {
  return (planned.template.subtasks ?? []).map((subtask, index) => ({
    ...parent,
    key: `${parent.key}#${index + 1}`,
    parentKey: parent.key,
    milestoneKey: null,
    templateKey: null,
    number: firstNumber + index,
    title: subtask.title,
    description: null,
    reviewerUserId: null,
    estimateMinutes: subtask.estimateMinutes ?? null,
    requiresReview: false,
    position: index,
    checklist: [],
    dependsOn: [],
  }));
}

/**
 * Turns a dated workflow plan into rows to insert. Tasks are numbered stage
 * by stage in template order, each followed by its subtasks. A task is
 * "ready" once it has an owner and a due date, otherwise it stays a draft.
 */
export function planFromTemplate(
  plan: ProjectWorkflowPlan,
  managerUserId: string,
  added: ReadonlySet<string> = new Set(),
): NewProjectPlan {
  const scope = {
    tasks: new Set(plan.tasks.map((task) => task.template.key)),
    milestones: new Set(plan.milestones.map((milestone) => milestone.template.key)),
    added,
  };
  const tasks: PlannedProjectTask[] = [];
  const deliverables: PlannedProjectDeliverable[] = [];
  let number = 0;
  for (const stage of plan.stages) {
    const order = stage.template.tasks.map((task) => task.key);
    const stageTasks = plan.tasks
      .filter((task) => task.stageKey === stage.template.key)
      .sort((a, b) => order.indexOf(a.template.key) - order.indexOf(b.template.key));
    stageTasks.forEach((planned, position) => {
      number += 1;
      const task = toTask(planned, number, position, scope);
      const subtasks = subtasksOf(task, planned, number + 1);
      number += subtasks.length;
      tasks.push(task, ...subtasks);
      for (const deliverable of planned.template.deliverables) {
        deliverables.push({
          taskKey: task.key,
          name: deliverable.name,
          isRequired: deliverable.required,
          reviewerUserId: task.reviewerUserId ?? managerUserId,
        });
      }
    });
  }
  return {
    stages: plan.stages.map((stage, index) => ({
      key: stage.template.key,
      templateKey: added.has(stage.template.key) ? null : stage.template.key,
      name: stage.template.name,
      description: stage.template.description ?? null,
      position: index,
      status: index === 0 ? 'active' : 'pending',
      plannedStartDate: stage.plannedStartDate,
      plannedEndDate: stage.plannedEndDate,
    })),
    milestones: plan.milestones.map((milestone, index) => ({
      key: milestone.template.key,
      stageKey: milestone.stageKey,
      name: milestone.template.name,
      dueDate: milestone.dueDate,
      requiresClientApproval: milestone.template.requiresClientApproval,
      position: index,
    })),
    tasks,
    deliverables,
  };
}

/** Projects without a template start with one open stage that tasks can be added to. */
export function singleStagePlan(startDate: string): NewProjectPlan {
  return {
    stages: [
      {
        key: 'project',
        templateKey: null,
        name: 'Project',
        description: null,
        position: 0,
        status: 'active',
        plannedStartDate: startDate,
        plannedEndDate: startDate,
      },
    ],
    milestones: [],
    tasks: [],
    deliverables: [],
  };
}
