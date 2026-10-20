import {
  type Actor,
  canAssignTasks,
  canManageProject,
  canViewProject,
  type ProjectMembership,
} from '@lintel/domain';
import { ForbiddenError, NotFoundError } from '@lintel/shared';
import type { ProjectAccessFacts, ProjectAccessStore } from './project-access.store';

export interface ProjectAccess extends ProjectAccessFacts {
  readonly canView: boolean;
  readonly canManage: boolean;
  readonly canAssign: boolean;
}

/**
 * Backend authorisation for project-scoped resources. Missing and forbidden
 * resources both answer "not found" so IDs cannot be probed (no IDOR leaks).
 */
export class ProjectAccessService {
  constructor(private readonly store: ProjectAccessStore) {}

  async evaluate(actor: Actor, projectId: string): Promise<ProjectAccess> {
    const facts = await this.store.accessFacts(projectId, actor.userId);
    const membership: ProjectMembership = { projectId, projectRole: facts.projectRole };
    const isProjectManager = facts.managerUserId === actor.userId;
    const effective: ProjectMembership = isProjectManager
      ? { projectId, projectRole: 'manager' }
      : membership;
    return {
      ...facts,
      canView:
        facts.exists && (canViewProject(actor, effective) || facts.ownerUserId === actor.userId),
      canManage: facts.exists && canManageProject(actor, effective),
      canAssign: facts.exists && canAssignTasks(actor, effective),
    };
  }

  async requireView(actor: Actor, projectId: string, entity = 'Project'): Promise<ProjectAccess> {
    const access = await this.evaluate(actor, projectId);
    if (!access.canView) throw new NotFoundError(entity);
    return access;
  }

  async requireManage(actor: Actor, projectId: string, entity = 'Project'): Promise<ProjectAccess> {
    const access = await this.requireView(actor, projectId, entity);
    if (!access.canManage) throw new ForbiddenError('Only the project manager can do this.');
    return access;
  }

  async requireTaskView(actor: Actor, taskId: string): Promise<ProjectAccess> {
    const projectId = await this.store.projectIdOfTask(taskId);
    if (!projectId) throw new NotFoundError('Task');
    return this.requireView(actor, projectId, 'Task');
  }

  async requireDeliverableView(actor: Actor, deliverableId: string): Promise<ProjectAccess> {
    const projectId = await this.store.projectIdOfDeliverable(deliverableId);
    if (!projectId) throw new NotFoundError('Deliverable');
    return this.requireView(actor, projectId, 'Deliverable');
  }

  /** Projects the actor may see, or "all" when they hold projects.view_all. */
  async visibleProjectIds(actor: Actor): Promise<string[] | 'all'> {
    if (actor.capabilities.has('projects.view_all')) return 'all';
    return this.store.memberProjectIds(actor.userId);
  }
}
