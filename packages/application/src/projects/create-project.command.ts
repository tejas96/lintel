import { domainEvent, type ProjectCriticality, type ProjectType } from '@lintel/domain';
import {
  type CalendarDate,
  calendarDateInTimeZone,
  isCalendarDate,
  pluralize,
  ValidationFailedError,
} from '@lintel/shared';
import { requireCapability } from '../common/capability-guard';
import type { RequestContext } from '../common/request-context';
import type { ApplicationStores } from '../common/unit-of-work';
import type { ProjectCommandDependencies } from './command-dependencies';
import type { ProjectMemberInput } from './project.store';
import { announceNewAssignments } from './project-assignment.notices';
import {
  type ChosenTemplate,
  describeTailoring,
  type PlanTailoringInput,
  prepareProjectPlan,
} from './project-plan.preparation';
import type { NewProjectPlan } from './project-plan.types';
import { nextProjectReference } from './project-reference';

export interface CreateProjectInput {
  readonly name: string;
  readonly clientName: string;
  readonly clientPhone: string | null;
  readonly clientEmail: string | null;
  readonly siteAddress: string | null;
  readonly projectType: ProjectType;
  readonly description: string | null;
  readonly criticality: ProjectCriticality;
  readonly managerUserId: string;
  readonly plannedStartDate: string;
  readonly templateVersionId: string | null;
  readonly templateOptions: readonly string[];
  readonly members: readonly ProjectMemberInput[];
  readonly budgetMinor: number | null;
  /** Changes to the template's plan made before the project starts. */
  readonly tailoring?: PlanTailoringInput | undefined;
}

/** Number of project colours in the design system palette (PROJECT_SWATCHES). */
const PROJECT_COLOR_COUNT = 6;

export function startDateOf(value: string): CalendarDate {
  if (isCalendarDate(value)) return value;
  throw new ValidationFailedError('Use a real start date.', [
    { field: 'plannedStartDate', message: 'Use a real date in YYYY-MM-DD format.' },
  ]);
}

function plannedEndOf(plan: NewProjectPlan, startDate: CalendarDate): string {
  return plan.stages.reduce(
    (latest, stage) =>
      stage.plannedEndDate && stage.plannedEndDate > latest ? stage.plannedEndDate : latest,
    startDate as string,
  );
}

/**
 * Creates a project and, when a published template is chosen, its whole
 * dated workflow — stages, milestones, tasks, checklists, deliverables and
 * dependencies — in one transaction with activity, audit and outbox records.
 */
export class CreateProjectCommand {
  constructor(private readonly deps: ProjectCommandDependencies) {}

  async execute(
    context: RequestContext,
    input: CreateProjectInput,
  ): Promise<{ id: string; reference: string }> {
    requireCapability(context, 'projects.create');
    const startDate = startDateOf(input.plannedStartDate);
    return this.deps.uow.transaction(async (stores) => {
      const prepared = await prepareProjectPlan(stores, input, startDate);
      const { chosen, plan, members } = prepared;
      const reference = await this.allocateReference(stores);
      const plannedEndDate = plannedEndOf(plan, startDate);
      const { id } = await stores.projects.insertProject({
        reference,
        name: input.name,
        clientName: input.clientName,
        clientPhone: input.clientPhone,
        clientEmail: input.clientEmail,
        siteAddress: input.siteAddress,
        description: input.description,
        projectType: input.projectType,
        criticality: input.criticality,
        managerUserId: input.managerUserId,
        ownerUserId: context.actor.userId,
        budgetMinor: input.budgetMinor,
        templateVersionId: chosen?.version.id ?? null,
        templateOptions: chosen ? [...new Set(input.templateOptions)] : [],
        plannedStartDate: startDate,
        plannedEndDate,
        colorIndex: (await stores.projects.projectCount()) % PROJECT_COLOR_COUNT,
        createdByUserId: context.actor.userId,
      });
      await stores.projects.replaceMembers(id, members);
      const taskIds = await stores.projects.insertPlan(id, context.actor.userId, plan);
      await this.record(stores, context, { id, reference, name: input.name }, chosen, {
        plan,
        tailored: describeTailoring(prepared.tailoring),
      });
      const assigned = plan.tasks.flatMap((task) => {
        const taskId = taskIds.get(task.key);
        return task.ownerUserId && taskId ? [{ taskId, ownerUserId: task.ownerUserId }] : [];
      });
      await announceNewAssignments(stores.records, await this.deps.notifierFor(stores), {
        actorUserId: context.actor.userId,
        project: { id, name: input.name },
        assigned,
      });
      return { id, reference };
    });
  }

  private async allocateReference(stores: ApplicationStores): Promise<string> {
    const settings = await stores.settings.organization();
    const today = calendarDateInTimeZone(this.deps.clock.now(), settings.timeZone);
    const year = Number(today.slice(0, 4));
    const prefix = settings.projectReferencePrefix;
    const issued = await stores.projects.referencesInSeries(prefix, year);
    return nextProjectReference(prefix, year, issued);
  }

  private async record(
    stores: ApplicationStores,
    context: RequestContext,
    project: { id: string; reference: string; name: string },
    chosen: ChosenTemplate | null,
    built: { plan: NewProjectPlan; tailored: string | null },
  ): Promise<void> {
    const { plan, tailored } = built;
    const source = chosen
      ? ` from "${chosen.template.name}" v${chosen.version.versionNumber}`
      : ' without a template';
    const changes = tailored ? ` Tailored before the start: ${tailored}.` : '';
    await stores.records.appendActivity({
      projectId: project.id,
      taskId: null,
      actorUserId: context.actor.userId,
      type: 'project.created',
      summary: `Created ${project.reference}${source} with ${pluralize(plan.tasks.length, 'task')}.${changes}`,
      payload: {
        templateVersionId: chosen?.version.id ?? null,
        taskCount: plan.tasks.length,
        tailored,
      },
    });
    await stores.records.appendAudit({
      actorUserId: context.actor.userId,
      action: 'project.created',
      entityType: 'project',
      entityId: project.id,
      after: {
        reference: project.reference,
        name: project.name,
        templateVersionId: chosen?.version.id ?? null,
        stageCount: plan.stages.length,
        taskCount: plan.tasks.length,
        tailored,
      },
      requestId: context.requestId,
    });
    await stores.records.enqueueEvent(
      domainEvent('ProjectCreated', 'project', project.id, {
        projectId: project.id,
        createdBy: context.actor.userId,
      }),
    );
  }
}
