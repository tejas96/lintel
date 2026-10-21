import type { Actor } from '@lintel/domain';
import { NotFoundError } from '@lintel/shared';
import { ProjectAccessService } from '../access/project-access.service';
import type { ApplicationStores } from '../common/unit-of-work';
import { templateVersionsOf } from './template-update.loader';

export interface TemplateUpdateStatus {
  readonly template: { readonly id: string; readonly name: string } | null;
  readonly current: { readonly id: string; readonly versionNumber: number } | null;
  /** The newest published version when it is newer than the one the project follows. */
  readonly available: {
    readonly id: string;
    readonly versionNumber: number;
    readonly changeNotes: string | null;
  } | null;
  readonly viewerCanUpdate: boolean;
}

type Stores = Pick<ApplicationStores, 'access' | 'templateUpdates' | 'templates'>;

/** Which template version a project follows and whether a newer one can be applied. */
export class TemplateUpdateStatusQuery {
  constructor(private readonly stores: Stores) {}

  async execute(actor: Actor, projectId: string): Promise<TemplateUpdateStatus> {
    const access = await new ProjectAccessService(this.stores.access).requireView(actor, projectId);
    const project = await this.stores.templateUpdates.project(projectId);
    if (!project) throw new NotFoundError('Project');
    const versions = await templateVersionsOf(this.stores, project.templateVersionId);
    if (!versions) {
      return { template: null, current: null, available: null, viewerCanUpdate: false };
    }
    const { template, current, latest } = versions;
    return {
      template: { id: template.id, name: template.name },
      current: { id: current.id, versionNumber: current.versionNumber },
      available: latest
        ? { id: latest.id, versionNumber: latest.versionNumber, changeNotes: latest.changeNotes }
        : null,
      viewerCanUpdate: access.canManage && latest !== null,
    };
  }
}
