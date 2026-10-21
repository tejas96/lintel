import { itemWillApply } from '@lintel/domain';
import { StaleVersionError } from '@lintel/shared';
import { ProjectAccessService } from '../access/project-access.service';
import type { RequestContext } from '../common/request-context';
import type { ApplicationStores } from '../common/unit-of-work';
import type { NotifierFactory } from '../notifications/notifier-factory';
import { announceNewAssignments } from '../projects/project-assignment.notices';
import type { TemplateUpdateDependencies } from './preview-template-update.query';
import { addTemplateTasks } from './template-added-tasks.writer';
import { applyMilestones, applyStages, existingIds } from './template-structure.writer';
import { cancelRemovedTasks, changeTemplateTasks } from './template-task-changes.writer';
import {
  forecastAfterUpdate,
  loadTemplateUpdate,
  type TemplateUpdateContext,
} from './template-update.loader';
import type { TemplateUpdateSummary } from './template-update.store';

export interface ApplyTemplateUpdateInput {
  readonly targetVersionId: string;
  /** Keys of held items the manager explicitly ticked. */
  readonly ticked: readonly string[];
  /** Move the planned end when the new work runs past it. */
  readonly extendPlannedEnd: boolean;
  readonly expectedProjectVersion: number;
}

export interface AppliedTemplateUpdate {
  readonly summary: TemplateUpdateSummary;
  readonly toVersionNumber: number;
}

/**
 * Moves a running project to the newest published version of its template.
 * Adds new items, updates unstarted ones, cancels removed unstarted tasks;
 * started work, committed dates and closed items change only when ticked
 * (finished work never). One transaction, with schedule history, activity,
 * audit and the project's new template version.
 */
export class ApplyTemplateUpdateCommand {
  constructor(
    private readonly deps: TemplateUpdateDependencies & { readonly notifierFor: NotifierFactory },
  ) {}

  async execute(
    context: RequestContext,
    projectId: string,
    input: ApplyTemplateUpdateInput,
  ): Promise<AppliedTemplateUpdate> {
    return this.deps.uow.transaction(async (stores) => {
      await new ProjectAccessService(stores.access).requireManage(context.actor, projectId);
      const loaded = await loadTemplateUpdate(
        stores,
        this.deps.clock,
        projectId,
        input.targetVersionId,
        true,
      );
      if (loaded.project.version !== input.expectedProjectVersion) {
        throw new StaleVersionError('This project');
      }
      const ticked = new Set(
        input.ticked.filter((key) =>
          loaded.plan.items.some((item) => item.key === key && item.optIn),
        ),
      );
      const label = `“${loaded.template.name}” v${loaded.target.versionNumber}`;
      const actor = { userId: context.actor.userId, reason: `Template updated to ${label}.` };
      const ids = existingIds(loaded);
      await applyStages(stores, loaded, ticked, ids);
      await applyMilestones(stores, loaded, ticked, ids);
      const added = await addTemplateTasks(stores, loaded, ticked, ids, actor);
      await changeTemplateTasks(stores, loaded, ticked, ids, actor);
      await cancelRemovedTasks(stores, loaded, ticked, actor);
      await this.skipEmptiedStages(stores, loaded, ticked);
      const forecast = forecastAfterUpdate(loaded, ticked);
      const extendTo =
        input.extendPlannedEnd && forecast && forecast > loaded.project.plannedEndDate
          ? forecast
          : null;
      const moved = await stores.templateUpdates.moveProject(
        projectId,
        input.expectedProjectVersion,
        loaded.target.id,
        extendTo,
      );
      if (!moved) throw new StaleVersionError('This project');
      const summary = this.summarise(loaded, ticked, extendTo);
      await this.record(stores, context, loaded, summary, label);
      await announceNewAssignments(stores.records, await this.deps.notifierFor(stores), {
        actorUserId: context.actor.userId,
        project: { id: projectId, name: loaded.project.name },
        assigned: added.assigned,
        window: `template-update:${loaded.target.id}`,
      });
      return { summary, toVersionNumber: loaded.target.versionNumber };
    });
  }

  /** Removed stages that have not started are skipped once no open task is left in them. */
  private async skipEmptiedStages(
    stores: ApplicationStores,
    loaded: TemplateUpdateContext,
    ticked: ReadonlySet<string>,
  ): Promise<void> {
    for (const item of loaded.plan.items) {
      if (item.kind !== 'stage' || item.change !== 'removed' || !item.itemId) continue;
      if (!itemWillApply(item, ticked)) continue;
      if (await stores.templateUpdates.stageHasOpenTasks(item.itemId)) continue;
      await stores.templateUpdates.updateStage(item.itemId, { status: 'skipped' });
    }
  }

  private summarise(
    loaded: TemplateUpdateContext,
    ticked: ReadonlySet<string>,
    extendTo: string | null,
  ): TemplateUpdateSummary {
    const items = loaded.plan.items.map((item) => ({
      key: item.key,
      change: item.change,
      name: item.name,
      applied: itemWillApply(item, ticked),
    }));
    const applied = (change: 'added' | 'changed' | 'removed') =>
      items.filter((item) => item.applied && item.change === change).length;
    return {
      added: applied('added'),
      changed: applied('changed'),
      cancelled: applied('removed'),
      heldBack: items.filter((item) => !item.applied).length,
      ticked: [...ticked],
      extendedPlannedEndTo: extendTo,
      items,
    };
  }

  private async record(
    stores: ApplicationStores,
    context: RequestContext,
    loaded: TemplateUpdateContext,
    summary: TemplateUpdateSummary,
    label: string,
  ): Promise<void> {
    await stores.templateUpdates.recordUpdate({
      projectId: loaded.project.id,
      fromVersionId: loaded.current.id,
      toVersionId: loaded.target.id,
      appliedByUserId: context.actor.userId,
      summary,
    });
    const counts = `${summary.added} added, ${summary.changed} changed, ${summary.cancelled} cancelled`;
    await stores.records.appendActivity({
      projectId: loaded.project.id,
      taskId: null,
      actorUserId: context.actor.userId,
      type: 'project.template_updated',
      summary: `Moved to ${label} from v${loaded.current.versionNumber}: ${counts}.`,
      payload: { fromVersionId: loaded.current.id, toVersionId: loaded.target.id },
    });
    await stores.records.appendAudit({
      actorUserId: context.actor.userId,
      action: 'project.template_updated',
      entityType: 'project',
      entityId: loaded.project.id,
      before: {
        templateVersionId: loaded.current.id,
        plannedEndDate: loaded.project.plannedEndDate,
      },
      after: {
        templateVersionId: loaded.target.id,
        added: summary.added,
        changed: summary.changed,
        cancelled: summary.cancelled,
        heldBack: summary.heldBack,
        ticked: summary.ticked,
        plannedEndDate: summary.extendedPlannedEndTo ?? loaded.project.plannedEndDate,
      },
      requestId: context.requestId,
    });
  }
}
