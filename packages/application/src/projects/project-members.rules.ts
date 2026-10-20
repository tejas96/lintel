import type { Actor } from '@lintel/domain';
import { type ErrorDetail, ValidationFailedError } from '@lintel/shared';
import type { ProjectAccess } from '../access/project-access.service';
import type { ProjectMemberInput, ProjectStore } from './project.store';

/**
 * The member list a project should have: the manager first with the
 * `manager` role (always present, even when the list leaves them out), then
 * everyone else once. Only the project manager holds the manager role.
 */
export function normalizeMembers(
  managerUserId: string,
  members: readonly ProjectMemberInput[],
): ProjectMemberInput[] {
  const issues: ErrorDetail[] = [];
  const seen = new Set<string>([managerUserId]);
  const others: ProjectMemberInput[] = [];
  members.forEach((member, index) => {
    const field = `members.${index}`;
    if (member.userId === managerUserId) {
      if (member.projectRole !== 'manager') {
        issues.push({ field, message: 'The project manager always has the manager role.' });
      }
      return;
    }
    if (member.projectRole === 'manager') {
      issues.push({ field, message: 'Only the project manager can hold the manager role.' });
    }
    if (seen.has(member.userId)) {
      issues.push({ field, message: 'This person is listed more than once.' });
      return;
    }
    seen.add(member.userId);
    others.push(member);
  });
  if (issues.length > 0) throw new ValidationFailedError('Check the project team.', issues);
  return [{ userId: managerUserId, projectRole: 'manager' }, ...others];
}

/** Rejects people who do not exist or are no longer active. */
export async function requireActiveUsers(
  store: ProjectStore,
  userIds: readonly string[],
  field = 'members',
): Promise<void> {
  const active = await store.activeUserIds(userIds);
  const missing = [...new Set(userIds)].filter((id) => !active.has(id));
  if (missing.length === 0) return;
  throw new ValidationFailedError(
    'Some people are not active members of the studio.',
    missing.map((id) => ({ field, message: `Person ${id} is not an active studio member.` })),
  );
}

/**
 * Budgets are visible to the studio owner and administrators, and to the
 * project's own manager and owner. Everyone else sees `null`.
 */
export function canSeeProjectFinances(actor: Actor, access: ProjectAccess): boolean {
  if (actor.role === 'owner' || actor.role === 'administrator') return true;
  return access.managerUserId === actor.userId || access.ownerUserId === actor.userId;
}
