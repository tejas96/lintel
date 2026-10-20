import {
  InvalidTransitionError,
  NotFoundError,
  PreconditionFailedError,
  StaleVersionError,
} from '@lintel/shared';
import { ProjectAccessService } from '../access/project-access.service';
import type { RequestContext } from '../common/request-context';
import type { ProjectCommandDependencies } from './command-dependencies';

/**
 * Completes a milestone once all its tasks are done or cancelled. When that
 * closes the last open work of its stage, the stage completes and the next
 * pending stage becomes active.
 */
export class CompleteMilestoneCommand {
  constructor(private readonly deps: ProjectCommandDependencies) {}

  /** Returns the project ID so callers can show the refreshed project. */
  async execute(
    context: RequestContext,
    milestoneId: string,
    expectedVersion: number,
    note: string | null,
  ): Promise<{ projectId: string }> {
    return this.deps.uow.transaction(async (stores) => {
      const projectId = await stores.access.projectIdOfMilestone(milestoneId);
      if (!projectId) throw new NotFoundError('Milestone');
      await new ProjectAccessService(stores.access).requireManage(
        context.actor,
        projectId,
        'Milestone',
      );
      const milestone = await stores.projects.findMilestone(milestoneId);
      if (!milestone) throw new NotFoundError('Milestone');
      if (milestone.status !== 'pending') {
        throw new InvalidTransitionError(`This milestone is already ${milestone.status}.`);
      }
      const open = await stores.projects.openTasksOfMilestone(milestoneId);
      if (open.length > 0) {
        throw new PreconditionFailedError(
          `${open.length} task(s) of "${milestone.name}" are still open.`,
          open.map((task) => ({ field: 'tasks', message: `#${task.number} ${task.title}` })),
        );
      }
      const now = this.deps.clock.now();
      const completed = await stores.projects.completeMilestone(
        milestoneId,
        expectedVersion,
        context.actor.userId,
        now,
      );
      if (!completed) throw new StaleVersionError('This milestone');
      await stores.records.appendActivity({
        projectId,
        taskId: null,
        actorUserId: context.actor.userId,
        type: 'milestone.completed',
        summary: `Completed milestone "${milestone.name}".${note ? ` ${note}` : ''}`,
        payload: { milestoneId, note },
      });
      await stores.records.appendAudit({
        actorUserId: context.actor.userId,
        action: 'milestone.completed',
        entityType: 'milestone',
        entityId: milestoneId,
        before: { status: milestone.status },
        after: { status: 'completed', note },
        requestId: context.requestId,
      });
      if (milestone.stageId && (await stores.projects.stageIsClosed(milestone.stageId))) {
        const { activated } = await stores.projects.completeStageAndActivateNext(
          milestone.stageId,
          now,
        );
        await stores.records.appendActivity({
          projectId,
          taskId: null,
          actorUserId: context.actor.userId,
          type: 'stage.completed',
          summary: activated
            ? `Stage complete. "${activated}" is now active.`
            : 'Final stage complete.',
          payload: { stageId: milestone.stageId, activated },
        });
      }
      return { projectId };
    });
  }
}
