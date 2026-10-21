import { itemWillApply, presentTemplateUpdatePlan, type TemplateItemChange } from '@lintel/domain';
import type { Clock } from '@lintel/shared';
import { ProjectAccessService } from '../access/project-access.service';
import type { RequestContext } from '../common/request-context';
import type { ApplicationStores, UnitOfWork } from '../common/unit-of-work';
import { forecastAfterUpdate, loadTemplateUpdate } from './template-update.loader';

export interface TemplateUpdatePreviewItem extends TemplateItemChange {
  /** The stage's name as people know it (the project's, else the new template's). */
  readonly stageName: string | null;
  /** For tasks the update adds: when they would run and who would own them. */
  readonly schedule: {
    readonly plannedStartDate: string;
    readonly dueDate: string;
    readonly ownerUserId: string | null;
  } | null;
  /** Whether the item changes with the given ticks. */
  readonly willApply: boolean;
  readonly ticked: boolean;
}

export interface TemplateUpdatePreview {
  readonly projectId: string;
  readonly projectVersion: number;
  readonly template: { readonly id: string; readonly name: string };
  readonly from: { readonly id: string; readonly versionNumber: number };
  readonly to: {
    readonly id: string;
    readonly versionNumber: number;
    readonly changeNotes: string | null;
  };
  readonly items: TemplateUpdatePreviewItem[];
  readonly unchanged: {
    readonly stages: number;
    readonly milestones: number;
    readonly tasks: number;
  };
  readonly plannedEndDate: string;
  /** The latest open due date once the update applies with these ticks. */
  readonly forecastEndDate: string | null;
}

export interface TemplateUpdateDependencies {
  readonly uow: UnitOfWork<ApplicationStores>;
  readonly clock: Clock;
}

/** A dry run: what moving to the newer version would do, given what the manager has ticked. */
export class PreviewTemplateUpdateQuery {
  constructor(private readonly deps: TemplateUpdateDependencies) {}

  async execute(
    context: RequestContext,
    projectId: string,
    request: { readonly targetVersionId: string; readonly ticked: readonly string[] },
  ): Promise<TemplateUpdatePreview> {
    const stores = this.deps.uow.stores;
    await new ProjectAccessService(stores.access).requireManage(context.actor, projectId);
    const loaded = await loadTemplateUpdate(
      stores,
      this.deps.clock,
      projectId,
      request.targetVersionId,
      false,
    );
    const ticked = new Set(request.ticked);
    const presented = presentTemplateUpdatePlan(loaded.plan, loaded.input);
    const stageNames = new Map<string, string>(
      loaded.input.to.stages.map((stage) => [stage.key, stage.name]),
    );
    for (const stage of loaded.input.project.stages) {
      if (stage.templateKey) stageNames.set(stage.templateKey, stage.name);
    }
    return {
      projectId,
      projectVersion: loaded.project.version,
      template: { id: loaded.template.id, name: loaded.template.name },
      from: { id: loaded.current.id, versionNumber: loaded.current.versionNumber },
      to: {
        id: loaded.target.id,
        versionNumber: loaded.target.versionNumber,
        changeNotes: loaded.target.changeNotes,
      },
      items: presented.items.map((item) => {
        const schedule = item.kind === 'task' ? loaded.schedule.get(item.templateKey) : undefined;
        return {
          ...item,
          stageName: item.stageKey ? (stageNames.get(item.stageKey) ?? null) : null,
          schedule: schedule
            ? {
                plannedStartDate: schedule.plannedStartDate,
                dueDate: schedule.dueDate,
                ownerUserId: schedule.ownerUserId,
              }
            : null,
          willApply: itemWillApply(item, ticked),
          ticked: ticked.has(item.key) && item.optIn !== null,
        };
      }),
      unchanged: presented.unchanged,
      plannedEndDate: loaded.project.plannedEndDate,
      forecastEndDate: forecastAfterUpdate(loaded, ticked),
    };
  }
}
