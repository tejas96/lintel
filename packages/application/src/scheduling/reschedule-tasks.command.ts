import { PreconditionFailedError, StaleVersionError, ValidationFailedError } from '@lintel/shared';
import { ProjectAccessService } from '../access/project-access.service';
import type { RequestContext } from '../common/request-context';
import type { ApplicationStores } from '../common/unit-of-work';
import type { ProjectCommandDependencies } from '../projects/command-dependencies';
import type { ProjectScheduleFacts } from '../scope-changes/scope-change.store';
import type { TaskDateRequest } from '../scope-changes/scope-change-additions';
import type { TaskRecord } from '../tasks/task.store';
import { notifyAboutTask, quoted } from '../tasks/task-records';
import { deadlineText, recordScheduleChange } from '../tasks/task-schedule-records';
import { type PreviewedMove, previewReschedule, type ReschedulePreview } from './reschedule-plan';

export interface RescheduleInput {
  readonly changes: readonly TaskDateRequest[];
  /** Why committed deadlines move; kept in each task's schedule history. */
  readonly reason: string | null;
  /** The versions the person saw of the tasks they moved (stale views are refused). */
  readonly expectedVersions: readonly { readonly taskId: string; readonly version: number }[];
}

interface AppliedMove {
  readonly move: PreviewedMove;
  readonly before: TaskRecord;
  readonly after: TaskRecord;
}

async function scheduleFacts(stores: ApplicationStores, projectId: string) {
  const facts = await stores.scopeChanges.scheduleFacts(projectId);
  if (!facts) throw new PreconditionFailedError('The project has no schedule yet.');
  return facts;
}

/**
 * Moves and resizes task bars on the project timeline. Only the project
 * manager may do it. Work that waits on a moved task is pushed with it (the
 * domain's knock-on rule); a committed deadline needs a reason and keeps its
 * history; anything that would move the agreed end date must go through a
 * scope change instead, so it can be approved.
 */
export class RescheduleTasksCommand {
  constructor(private readonly deps: ProjectCommandDependencies) {}

  async preview(
    context: RequestContext,
    projectId: string,
    changes: readonly TaskDateRequest[],
  ): Promise<ReschedulePreview> {
    const stores = this.deps.uow.stores;
    await new ProjectAccessService(stores.access).requireManage(context.actor, projectId);
    const facts = await scheduleFacts(stores, projectId);
    return previewReschedule(facts, changes, await stores.settings.defaultCalendar());
  }

  async apply(
    context: RequestContext,
    projectId: string,
    input: RescheduleInput,
  ): Promise<{ readonly moved: number }> {
    return this.deps.uow.transaction(async (stores) => {
      await new ProjectAccessService(stores.access).requireManage(context.actor, projectId);
      const facts = await scheduleFacts(stores, projectId);
      const preview = previewReschedule(
        facts,
        input.changes,
        await stores.settings.defaultCalendar(),
      );
      if (preview.requiresScopeChange) {
        throw new PreconditionFailedError(
          `These dates move the agreed end date from ${preview.plannedEndDate} to ${preview.forecastEndDate}. Propose a scope change instead, so it can be approved.`,
        );
      }
      const reason = input.reason?.trim() ?? '';
      if (preview.needsReason && reason.length < 3) {
        throw new ValidationFailedError('Explain why the committed deadlines move.', [
          { field: 'reason', message: 'Add the reason for the new dates.' },
        ]);
      }
      const moved = await this.applyMoves(stores, context, preview.moves, input, reason);
      await this.record(stores, context, facts, { moved, reason, preview });
      return { moved: moved.length };
    });
  }

  /** Moves each task (the dragged ones must still be at the version the person saw). */
  private async applyMoves(
    stores: ApplicationStores,
    context: RequestContext,
    moves: readonly PreviewedMove[],
    input: RescheduleInput,
    reason: string,
  ): Promise<AppliedMove[]> {
    const versions = new Map(input.expectedVersions.map((entry) => [entry.taskId, entry.version]));
    const moved: AppliedMove[] = [];
    for (const move of moves) {
      const before = await stores.tasks.findForUpdate(move.taskId);
      if (!before) continue;
      const expected = versions.get(move.taskId) ?? before.version;
      const after =
        expected === before.version
          ? await stores.tasks.update(before.id, before.version, {
              plannedStartDate: move.proposedStartDate,
              dueDate: move.proposedDueDate,
            })
          : null;
      if (!after) throw new StaleVersionError(`"${before.title}"`);
      if (move.committed) {
        const why = move.isDownstream
          ? `Moved because work it waits for was rescheduled: ${reason}`
          : `Rescheduled on the timeline: ${reason}`;
        await recordScheduleChange(stores, context, before, after, why);
      }
      moved.push({ move, before, after });
    }
    return moved;
  }

  private async record(
    stores: ApplicationStores,
    context: RequestContext,
    facts: ProjectScheduleFacts,
    done: {
      moved: readonly AppliedMove[];
      reason: string;
      preview: ReschedulePreview;
    },
  ): Promise<void> {
    const { moved, reason } = done;
    const pushed = moved.filter((entry) => entry.move.isDownstream).length;
    const knockOn = pushed > 0 ? ` (${pushed} waiting task(s) moved with it)` : '';
    const why = reason ? `: ${reason}` : '.';
    await stores.records.appendActivity({
      projectId: facts.projectId,
      taskId: null,
      actorUserId: context.actor.userId,
      type: 'project.rescheduled',
      summary: `Rescheduled ${moved.length} task(s) on the timeline${knockOn}${why}`,
      payload: { taskIds: moved.map((entry) => entry.after.id), reason },
    });
    await stores.records.appendAudit({
      actorUserId: context.actor.userId,
      action: 'project.rescheduled',
      entityType: 'project',
      entityId: facts.projectId,
      after: {
        reason,
        moves: moved.map(({ move }) => ({
          taskId: move.taskId,
          from: [move.currentStartDate, move.currentDueDate],
          to: [move.proposedStartDate, move.proposedDueDate],
          isDownstream: move.isDownstream,
        })),
        slippingMilestoneIds: done.preview.slippingMilestones.map((milestone) => milestone.id),
      },
      requestId: context.requestId,
    });
    const notifier = await this.deps.notifierFor(stores);
    for (const { move, before, after } of moved) {
      if (!move.committed) continue;
      await notifyAboutTask(notifier, context.actor.userId, after, `v${after.version}`, [
        {
          kind: 'priority_changed',
          recipientUserId: after.ownerUserId,
          title: `${quoted(after.title)} moved`,
          body: `Due ${deadlineText(before)} is now ${deadlineText(after)}${why}`,
        },
      ]);
    }
  }
}
