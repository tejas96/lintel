import type { Actor } from '@lintel/domain';
import { NotFoundError, PreconditionFailedError } from '@lintel/shared';
import type { ProjectAccess, ProjectAccessService } from '../access/project-access.service';
import { canSeeProjectFinances } from '../projects/project-members.rules';
import type { SettingsStore } from '../settings/settings.store';

export interface ProjectFinanceAccess {
  readonly access: ProjectAccess;
  readonly currency: string;
}

/**
 * Budgets and costs: the project must be visible and the person allowed to see
 * its finances (`projects.manage_any`, or the project's manager or owner).
 * Missing, hidden and finance-restricted projects all answer 404. When the
 * studio has profitability switched off, reads answer 404 ("not switched on")
 * and writes explain how to switch it on.
 */
export async function requireProjectFinances(
  projectAccess: ProjectAccessService,
  settings: Pick<SettingsStore, 'organization'>,
  actor: Actor,
  projectId: string,
  purpose: 'read' | 'write',
): Promise<ProjectFinanceAccess> {
  const access = await projectAccess.requireView(actor, projectId);
  if (!canSeeProjectFinances(actor, access)) throw new NotFoundError('Project costs');
  const organization = await settings.organization();
  if (!organization.profitabilityEnabled) {
    if (purpose === 'read') throw new NotFoundError('Project profitability');
    throw new PreconditionFailedError(
      'Profitability is switched off. Turn it on in Settings before recording costs.',
    );
  }
  return { access, currency: organization.currency };
}
