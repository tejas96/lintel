import { PreconditionFailedError } from '@lintel/shared';
import type { ProjectAccess } from '../access/project-access.service';
import type { ApplicationStores } from '../common/unit-of-work';

/**
 * Adding someone to a project gives them every task, file and client detail
 * in it, so only people who manage the project may do it implicitly (by
 * assigning work). Others may only involve people who are already members.
 */
export async function admitToProject(
  stores: Pick<ApplicationStores, 'access' | 'tasks'>,
  access: ProjectAccess,
  projectId: string,
  userIds: readonly (string | null | undefined)[],
): Promise<void> {
  for (const userId of userIds) {
    if (!userId) continue;
    if (access.canManage) {
      await stores.tasks.ensureProjectMember(projectId, userId);
      continue;
    }
    const facts = await stores.access.accessFacts(projectId, userId);
    const isMember = facts.projectRole !== null || facts.managerUserId === userId;
    if (!isMember) {
      throw new PreconditionFailedError(
        'That person is not on this project yet. Ask the project manager to add them first.',
        [{ message: 'Only project managers can add people to a project.' }],
      );
    }
  }
}
