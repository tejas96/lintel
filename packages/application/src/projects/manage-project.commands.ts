import { isLegalProjectTransition, type ProjectStatus } from '@lintel/domain';
import {
  type ErrorDetail,
  InvalidTransitionError,
  NotFoundError,
  type Patch,
  PreconditionFailedError,
  pluralize,
  StaleVersionError,
} from '@lintel/shared';
import { ProjectAccessService } from '../access/project-access.service';
import type { RequestContext } from '../common/request-context';
import type { ApplicationStores } from '../common/unit-of-work';
import { businessToday, type ProjectCommandDependencies } from './command-dependencies';
import type {
  OpenTaskFact,
  ProjectDetailsInput,
  ProjectMemberInput,
  ProjectRecord,
  ProjectStatusChange,
} from './project.store';
import { normalizeMembers, requireActiveUsers } from './project-members.rules';

const DETAIL_FIELDS: readonly (keyof ProjectDetailsInput)[] = [
  'name',
  'clientName',
  'clientPhone',
  'clientEmail',
  'siteAddress',
  'description',
  'criticality',
  'managerUserId',
  'budgetMinor',
];

function taskList(tasks: readonly OpenTaskFact[]): string {
  const shown = tasks.slice(0, 5).map((task) => `#${task.number} ${task.title}`);
  return tasks.length > shown.length ? `${shown.join(', ')} …` : shown.join(', ');
}

function changedFields(before: ProjectRecord, after: ProjectRecord) {
  const fields = DETAIL_FIELDS.filter((field) => before[field] !== after[field]);
  const pick = (record: ProjectRecord) =>
    Object.fromEntries(fields.map((field) => [field, record[field]]));
  return { fields, before: pick(before), after: pick(after) };
}

/** Editing a project: details, status and team. Only its manager (or `projects.manage_any`). */
export class ManageProjectCommands {
  constructor(private readonly deps: ProjectCommandDependencies) {}

  async update(
    context: RequestContext,
    projectId: string,
    expectedVersion: number,
    changes: Patch<ProjectDetailsInput>,
  ): Promise<void> {
    await this.deps.uow.transaction(async (stores) => {
      const before = await this.manageable(stores, context, projectId);
      const newManager =
        changes.managerUserId && changes.managerUserId !== before.managerUserId
          ? changes.managerUserId
          : null;
      if (newManager) await requireActiveUsers(stores.projects, [newManager], 'managerUserId');
      const after = await stores.projects.update(projectId, expectedVersion, changes);
      if (!after) throw new StaleVersionError('This project');
      if (newManager) await this.handOver(stores, projectId, before.managerUserId, newManager);
      const diff = changedFields(before, after);
      if (diff.fields.length === 0) return;
      await stores.records.appendActivity({
        projectId,
        taskId: null,
        actorUserId: context.actor.userId,
        type: newManager ? 'project.manager_changed' : 'project.updated',
        summary: `Updated ${diff.fields.join(', ')}.`,
        payload: { fields: diff.fields },
      });
      await stores.records.appendAudit({
        actorUserId: context.actor.userId,
        action: 'project.updated',
        entityType: 'project',
        entityId: projectId,
        before: diff.before,
        after: diff.after,
        requestId: context.requestId,
      });
    });
  }

  async changeStatus(
    context: RequestContext,
    projectId: string,
    expectedVersion: number,
    status: ProjectStatus,
    note: string | null,
  ): Promise<void> {
    await this.deps.uow.transaction(async (stores) => {
      const before = await this.manageable(stores, context, projectId);
      if (!isLegalProjectTransition(before.status, status)) {
        throw new InvalidTransitionError(
          `A project cannot move from ${before.status} to ${status}.`,
        );
      }
      if (status === 'completed') {
        const open = await stores.projects.openTasks(projectId);
        if (open.length > 0) {
          throw new PreconditionFailedError(
            `${pluralize(open.length, 'open task')} must be done or cancelled before the project can be completed.`,
            [{ field: 'status', message: `Still open: ${taskList(open)}` }],
          );
        }
      }
      const change: ProjectStatusChange =
        status === 'completed'
          ? { status, actualEndDate: await businessToday(stores, this.deps.clock) }
          : status === 'archived'
            ? { status, archivedAt: this.deps.clock.now() }
            : { status, actualEndDate: null, archivedAt: null };
      const after = await stores.projects.changeStatus(projectId, expectedVersion, change);
      if (!after) throw new StaleVersionError('This project');
      await stores.records.appendActivity({
        projectId,
        taskId: null,
        actorUserId: context.actor.userId,
        type: 'project.status_changed',
        summary: `Status changed from ${before.status} to ${status}.${note ? ` ${note}` : ''}`,
        payload: { from: before.status, to: status, note },
      });
      await stores.records.appendAudit({
        actorUserId: context.actor.userId,
        action: 'project.status_changed',
        entityType: 'project',
        entityId: projectId,
        before: { status: before.status },
        after: { status, note },
        requestId: context.requestId,
      });
    });
  }

  async setMembers(
    context: RequestContext,
    projectId: string,
    members: readonly ProjectMemberInput[],
  ): Promise<void> {
    await this.deps.uow.transaction(async (stores) => {
      const project = await this.manageable(stores, context, projectId);
      const next = normalizeMembers(project.managerUserId, members);
      const current = await stores.projects.members(projectId);
      const currentIds = new Set(current.map((member) => member.userId));
      const nextIds = new Set(next.map((member) => member.userId));
      const added = next.filter((member) => !currentIds.has(member.userId));
      const removed = current.filter((member) => !nextIds.has(member.userId));
      await requireActiveUsers(
        stores.projects,
        added.map((member) => member.userId),
      );
      await this.ensureNoOpenWork(stores, projectId, removed);
      await stores.projects.replaceMembers(projectId, next);
      await stores.records.appendActivity({
        projectId,
        taskId: null,
        actorUserId: context.actor.userId,
        type: 'project.members_changed',
        summary: `Team updated: ${added.length} added, ${removed.length} removed.`,
        payload: {
          added: added.map((member) => member.userId),
          removed: removed.map((member) => member.userId),
        },
      });
      await stores.records.appendAudit({
        actorUserId: context.actor.userId,
        action: 'project.members_changed',
        entityType: 'project',
        entityId: projectId,
        before: { members: current },
        after: { members: next },
        requestId: context.requestId,
      });
    });
  }

  private async manageable(
    stores: ApplicationStores,
    context: RequestContext,
    projectId: string,
  ): Promise<ProjectRecord> {
    await new ProjectAccessService(stores.access).requireManage(context.actor, projectId);
    const project = await stores.projects.findById(projectId);
    if (!project) throw new NotFoundError('Project');
    return project;
  }

  private async ensureNoOpenWork(
    stores: ApplicationStores,
    projectId: string,
    removed: readonly ProjectMemberInput[],
  ): Promise<void> {
    if (removed.length === 0) return;
    const removedIds = new Set(removed.map((member) => member.userId));
    const open = (await stores.projects.openTasks(projectId)).filter(
      (task) => task.ownerUserId !== null && removedIds.has(task.ownerUserId),
    );
    if (open.length === 0) return;
    const names = await stores.projects.userNames([...removedIds]);
    const details: ErrorDetail[] = [...removedIds].flatMap((userId) => {
      const owned = open.filter((task) => task.ownerUserId === userId);
      if (owned.length === 0) return [];
      const name = names.get(userId) ?? 'This person';
      return [
        {
          field: 'members',
          message: `${name} owns ${pluralize(owned.length, 'open task')}: ${taskList(owned)}`,
        },
      ];
    });
    throw new PreconditionFailedError(
      'Reassign their open tasks before removing people from the project.',
      details,
    );
  }

  /** The new manager joins as manager; the previous one stays on the team as a member. */
  private async handOver(
    stores: ApplicationStores,
    projectId: string,
    previousManagerId: string,
    newManagerId: string,
  ): Promise<void> {
    const members = await stores.projects.members(projectId);
    const others = members
      .filter((member) => member.userId !== newManagerId)
      .map((member) =>
        member.userId === previousManagerId
          ? { ...member, projectRole: 'member' as const }
          : member,
      );
    await stores.projects.replaceMembers(projectId, [
      { userId: newManagerId, projectRole: 'manager' },
      ...others,
    ]);
  }
}
