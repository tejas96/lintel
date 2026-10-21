import { type CalendarDate, maxCalendarDate } from '@lintel/shared';
import {
  addWorkingDays,
  nextWorkingDayOnOrAfter,
  type WorkingCalendar,
} from '../calendar/working-calendar';
import type { ProjectRole } from '../identity/roles';
import { topologicalTaskOrder } from '../tasks/task-dependency-graph';
import type {
  TemplateMilestone,
  TemplateStage,
  TemplateTask,
  WorkflowTemplateDefinition,
} from './workflow-template-definition';

export interface PlannedTask {
  readonly template: TemplateTask;
  readonly stageKey: string;
  readonly plannedStartDate: CalendarDate;
  readonly dueDate: CalendarDate;
  readonly ownerUserId: string | null;
  readonly reviewerUserId: string | null;
  /** The start date was chosen by hand rather than worked out from prerequisites. */
  readonly startPinned: boolean;
  /** A chosen start falls before a prerequisite is due (the work overlaps). */
  readonly overlapsPrerequisite: boolean;
}

export interface PlannedMilestone {
  readonly template: TemplateMilestone;
  readonly stageKey: string;
  readonly dueDate: CalendarDate;
}

export interface PlannedStage {
  readonly template: TemplateStage;
  readonly position: number;
  readonly plannedStartDate: CalendarDate;
  readonly plannedEndDate: CalendarDate;
}

export interface ProjectWorkflowPlan {
  readonly stages: readonly PlannedStage[];
  readonly milestones: readonly PlannedMilestone[];
  readonly tasks: readonly PlannedTask[];
  readonly plannedEndDate: CalendarDate;
}

/**
 * Builds a dated project plan from a template (Builder pattern): choose the
 * options, map roles to people, then `build()`. Tasks start after their
 * prerequisites and move forward by working days.
 */
export class ProjectWorkflowPlanBuilder {
  private readonly options = new Set<string>();
  private readonly assignees = new Map<ProjectRole, string>();
  private readonly pinnedStarts = new Map<string, CalendarDate>();
  private readonly taskOwners = new Map<string, string | null>();

  constructor(
    private readonly definition: WorkflowTemplateDefinition,
    private readonly calendar: WorkingCalendar,
    private readonly projectStartDate: CalendarDate,
  ) {}

  withOption(option: string): this {
    this.options.add(option);
    return this;
  }

  assignRole(role: ProjectRole, userId: string): this {
    this.assignees.set(role, userId);
    return this;
  }

  /** Starts the task on this date (the next working day if it is not one). */
  pinStart(taskKey: string, date: CalendarDate): this {
    this.pinnedStarts.set(taskKey, date);
    return this;
  }

  /** Gives one task to a person (or to nobody), whatever its role maps to. */
  assignTask(taskKey: string, userId: string | null): this {
    this.taskOwners.set(taskKey, userId);
    return this;
  }

  build(): ProjectWorkflowPlan {
    const stages = this.definition.stages.filter((stage) =>
      (stage.requiresOptions ?? []).every((option) => this.options.has(option)),
    );
    const tasks = this.scheduleTasks(stages);
    const start = nextWorkingDayOnOrAfter(this.calendar, this.projectStartDate);
    let previousEnd = start;
    const plannedStages = stages.map((stage, position) => {
      const own = tasks.filter((task) => task.stageKey === stage.key);
      // A stage without tasks sits where the previous stage ends.
      const stageStart = own.reduce(
        (min, t) => (t.plannedStartDate < min ? t.plannedStartDate : min),
        own[0]?.plannedStartDate ?? previousEnd,
      );
      const stageEnd = own.reduce((max, t) => maxCalendarDate(max, t.dueDate), stageStart);
      previousEnd = maxCalendarDate(previousEnd, stageEnd);
      return { template: stage, position, plannedStartDate: stageStart, plannedEndDate: stageEnd };
    });
    const milestones = stages.flatMap((stage) =>
      stage.milestones.map((milestone) => ({
        template: milestone,
        stageKey: stage.key,
        dueDate: this.milestoneDueDate(milestone.key, stage.key, tasks, plannedStages),
      })),
    );
    const plannedEndDate = plannedStages.reduce(
      (max, s) => maxCalendarDate(max, s.plannedEndDate),
      start,
    );
    return { stages: plannedStages, milestones, tasks, plannedEndDate };
  }

  private scheduleTasks(stages: readonly TemplateStage[]): PlannedTask[] {
    const byKey = new Map<string, { task: TemplateTask; stageKey: string }>();
    for (const stage of stages) {
      for (const task of stage.tasks) byKey.set(task.key, { task, stageKey: stage.key });
    }
    const edges = [...byKey.values()].flatMap(({ task }) =>
      task.dependsOn
        .filter((dependency) => byKey.has(dependency))
        .map((dependency) => ({ taskId: task.key, dependsOnTaskId: dependency })),
    );
    const order = topologicalTaskOrder([...byKey.keys()], edges);
    if (order === null) throw new RangeError('Template task dependencies form a loop.');
    const dueByKey = new Map<string, CalendarDate>();
    const planned: PlannedTask[] = [];
    for (const key of order) {
      const entry = byKey.get(key);
      if (!entry) continue;
      const { task, stageKey } = entry;
      const earliest = this.startDateFor(task, dueByKey);
      const pinned = this.pinnedStarts.get(key);
      const start = pinned ? nextWorkingDayOnOrAfter(this.calendar, pinned) : earliest;
      const dueDate = addWorkingDays(this.calendar, start, task.durationDays - 1);
      dueByKey.set(key, dueDate);
      const ownerUserId = this.ownerFor(task);
      planned.push({
        template: task,
        stageKey,
        plannedStartDate: start,
        dueDate,
        ownerUserId,
        reviewerUserId: this.reviewerFor(task, ownerUserId),
        startPinned: pinned !== undefined,
        overlapsPrerequisite: start < earliest && task.dependsOn.some((dep) => dueByKey.has(dep)),
      });
    }
    return planned;
  }

  private ownerFor(task: TemplateTask): string | null {
    if (this.taskOwners.has(task.key)) return this.taskOwners.get(task.key) ?? null;
    return this.assignees.get(task.responsibleRole) ?? null;
  }

  /** Nobody reviews their own work: a task given by hand to its reviewer has no reviewer yet. */
  private reviewerFor(task: TemplateTask, ownerUserId: string | null): string | null {
    const reviewer = task.reviewerRole ? (this.assignees.get(task.reviewerRole) ?? null) : null;
    return reviewer !== null && reviewer === ownerUserId ? null : reviewer;
  }

  private startDateFor(task: TemplateTask, dueByKey: Map<string, CalendarDate>): CalendarDate {
    const first = nextWorkingDayOnOrAfter(this.calendar, this.projectStartDate);
    const prerequisiteDue = task.dependsOn
      .map((dependency) => dueByKey.get(dependency))
      .filter((date): date is CalendarDate => date !== undefined);
    if (prerequisiteDue.length === 0) return first;
    const latest = prerequisiteDue.reduce((max, date) => maxCalendarDate(max, date));
    return addWorkingDays(this.calendar, latest, 1);
  }

  private milestoneDueDate(
    milestoneKey: string,
    stageKey: string,
    tasks: readonly PlannedTask[],
    stages: readonly PlannedStage[],
  ): CalendarDate {
    const linked = tasks.filter((task) => task.template.milestoneKey === milestoneKey);
    if (linked.length > 0)
      return linked.reduce(
        (max, task) => maxCalendarDate(max, task.dueDate),
        linked[0]?.dueDate ?? this.projectStartDate,
      );
    const stage = stages.find((candidate) => candidate.template.key === stageKey);
    return stage?.plannedEndDate ?? this.projectStartDate;
  }
}
