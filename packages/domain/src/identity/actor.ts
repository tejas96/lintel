import type { Capability } from './capabilities';
import type { ProjectRole, Role } from './roles';

/** The authenticated person performing an operation. Built only on the server. */
export interface Actor {
  readonly userId: string;
  readonly role: Role;
  readonly capabilities: ReadonlySet<Capability>;
}

/** The actor's relationship to one project. `null` means not a member. */
export interface ProjectMembership {
  readonly projectId: string;
  readonly projectRole: ProjectRole | null;
}

export function canViewProject(actor: Actor, membership: ProjectMembership): boolean {
  return actor.capabilities.has('projects.view_all') || membership.projectRole !== null;
}

export function canManageProject(actor: Actor, membership: ProjectMembership): boolean {
  return actor.capabilities.has('projects.manage_any') || membership.projectRole === 'manager';
}

/** Assigning work needs the capability and a management relationship to the project. */
export function canAssignTasks(actor: Actor, membership: ProjectMembership): boolean {
  if (actor.capabilities.has('tasks.manage_any')) return true;
  if (!actor.capabilities.has('tasks.assign')) return false;
  return membership.projectRole === 'manager' || membership.projectRole === 'reviewer';
}
