import {
  type PlannedTask,
  type ProjectWorkflowPlan,
  ProjectWorkflowPlanBuilder,
  type WorkflowTemplateDefinition,
  type WorkingCalendar,
} from '@lintel/domain';
import type { CalendarDate } from '@lintel/shared';
import type { ProjectMemberInput } from './project.store';
import type { NewDeliverable, NewProjectPlan, NewTask } from './project-plan.types';

export interface WorkflowPlanRequest {
  readonly definition: WorkflowTemplateDefinition;
  readonly calendar: WorkingCalendar;
  readonly startDate: CalendarDate;
  readonly options: readonly string[];
  /** Members with their project roles; the manager is already among them. */
  readonly members: readonly ProjectMemberInput[];
}

/** Dates the template on the working calendar and assigns each role to the first member holding it. */
export function buildWorkflowPlan(request: WorkflowPlanRequest): ProjectWorkflowPlan {
  const builder = new ProjectWorkflowPlanBuilder(
    request.definition,
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
  return builder.build();
}

function readiness(ownerUserId: string | null, dueDate: string | null): 'ready' | 'draft' {
  return ownerUserId !== null && dueDate !== null ? 'ready' : 'draft';
}

function toTask(
  planned: PlannedTask,
  number: number,
  position: number,
  scope: { tasks: ReadonlySet<string>; milestones: ReadonlySet<string> },
): NewTask {
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
    templateKey: template.key,
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

function subtasksOf(parent: NewTask, planned: PlannedTask, firstNumber: number): NewTask[] {
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
export function planFromTemplate(plan: ProjectWorkflowPlan, managerUserId: string): NewProjectPlan {
  const scope = {
    tasks: new Set(plan.tasks.map((task) => task.template.key)),
    milestones: new Set(plan.milestones.map((milestone) => milestone.template.key)),
  };
  const tasks: NewTask[] = [];
  const deliverables: NewDeliverable[] = [];
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
      templateKey: stage.template.key,
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
