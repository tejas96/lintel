import {
  canSeeProjectFinances,
  ProjectAccessService,
  type RequestContext,
} from '@lintel/application';
import {
  type DatabaseConnection,
  loadProjectDetail,
  type ProjectDetailView,
} from '@lintel/database';
import { Inject, Injectable } from '@nestjs/common';
import { found } from '../../common/http/access';
import { BusinessContextService } from '../../infrastructure/business-context.service';
import { DATABASE_CONNECTION } from '../../infrastructure/tokens';

/**
 * Loads the ProjectDetail response for the viewer: checks access (missing
 * and hidden both 404), then applies viewer-specific fields such as budget.
 */
@Injectable()
export class ProjectDetailReader {
  constructor(
    private readonly access: ProjectAccessService,
    private readonly business: BusinessContextService,
    @Inject(DATABASE_CONNECTION) private readonly database: DatabaseConnection,
  ) {}

  async detail(context: RequestContext, projectId: string): Promise<ProjectDetailView> {
    const access = await this.access.requireView(context.actor, projectId);
    const [today, settings] = await Promise.all([this.business.today(), this.business.settings()]);
    const detail = await loadProjectDetail(this.database.db, projectId, {
      today,
      currency: settings.currency,
      canSeeBudget: canSeeProjectFinances(context.actor, access),
      viewerCanManage: access.canManage,
    });
    return found(detail, 'Project');
  }
}
