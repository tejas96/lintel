import {
  type ProjectRole,
  type ProjectWorkflowPlan,
  type TaskPriority,
  workingDaysBetween,
} from '@lintel/domain';
import { requireCapability } from '../common/capability-guard';
import type { RequestContext } from '../common/request-context';
import type { ApplicationStores, UnitOfWork } from '../common/unit-of-work';
import { startDateOf } from './create-project.command';
import { addedPlanKeys } from './project-plan.factory';
import { type ProjectPlanInput, prepareProjectPlan } from './project-plan.preparation';

export interface ProjectPlanPreviewInput extends ProjectPlanInput {
  readonly plannedStartDate: string;
}

export interface PlanPreviewTask {
  readonly key: string;
  readonly stageKey: string;
  readonly title: string;
  /** Added by the project manager rather than taken from the template. */
  readonly isAdded: boolean;
  readonly plannedStartDate: string;
  readonly dueDate: string;
  readonly durationDays: number;
  readonly ownerUserId: string | null;
  readonly responsibleRole: ProjectRole;
  readonly priority: TaskPriority;
  readonly dependsOn: string[];
  readonly milestoneKey: string | null;
  readonly startPinned: boolean;
  readonly overlapsPrerequisite: boolean;
}

export interface PlanPreviewStage {
  readonly key: string;
  readonly name: string;
  readonly isAdded: boolean;
  readonly plannedStartDate: string;
  readonly plannedEndDate: string;
  readonly milestones: { key: string; name: string; dueDate: string }[];
}

export interface ProjectPlanPreview {
  readonly plannedStartDate: string;
  readonly plannedEndDate: string;
  /** Working days from the first to the last planned day, both included. */
  readonly workingDays: number;
  readonly stages: PlanPreviewStage[];
  readonly tasks: PlanPreviewTask[];
}

type PreviewStores = Pick<ApplicationStores, 'templates' | 'settings' | 'projects'>;

function toPreview(
  workflow: ProjectWorkflowPlan,
  added: ReadonlySet<string>,
): Pick<ProjectPlanPreview, 'stages' | 'tasks'> {
  return {
    stages: workflow.stages.map((stage) => ({
      key: stage.template.key,
      name: stage.template.name,
      isAdded: added.has(stage.template.key),
      plannedStartDate: stage.plannedStartDate,
      plannedEndDate: stage.plannedEndDate,
      milestones: workflow.milestones
        .filter((milestone) => milestone.stageKey === stage.template.key)
        .map((milestone) => ({
          key: milestone.template.key,
          name: milestone.template.name,
          dueDate: milestone.dueDate,
        })),
    })),
    tasks: workflow.tasks.map((task) => ({
      key: task.template.key,
      stageKey: task.stageKey,
      title: task.template.title,
      isAdded: added.has(task.template.key),
      plannedStartDate: task.plannedStartDate,
      dueDate: task.dueDate,
      durationDays: task.template.durationDays,
      ownerUserId: task.ownerUserId,
      responsibleRole: task.template.responsibleRole,
      priority: task.template.priority,
      dependsOn: [...task.template.dependsOn],
      milestoneKey: task.template.milestoneKey ?? null,
      startPinned: task.startPinned,
      overlapsPrerequisite: task.overlapsPrerequisite,
    })),
  };
}

/**
 * The dated plan a new project would get, without creating anything: the
 * same checks and the same domain builder as creating the project, so the
 * wizard's live preview and end date are exactly what will be created.
 */
export class PreviewProjectPlanQuery {
  constructor(private readonly uow: UnitOfWork<PreviewStores>) {}

  async execute(
    context: RequestContext,
    input: ProjectPlanPreviewInput,
  ): Promise<ProjectPlanPreview> {
    requireCapability(context, 'projects.create');
    const startDate = startDateOf(input.plannedStartDate);
    const stores = this.uow.stores;
    const prepared = await prepareProjectPlan(stores, input, startDate);
    if (!prepared.workflow) {
      return {
        plannedStartDate: startDate,
        plannedEndDate: startDate,
        workingDays: 1,
        stages: [],
        tasks: [],
      };
    }
    const calendar = await stores.settings.defaultCalendar();
    const first = prepared.workflow.stages[0]?.plannedStartDate ?? startDate;
    const end = prepared.workflow.plannedEndDate;
    return {
      plannedStartDate: first,
      plannedEndDate: end,
      workingDays: workingDaysBetween(calendar, first, end) + 1,
      ...toPreview(prepared.workflow, addedPlanKeys(prepared.tailoring)),
    };
  }
}
