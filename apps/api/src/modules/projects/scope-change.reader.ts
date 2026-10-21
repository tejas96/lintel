import {
  canSeeProjectFinances,
  ProjectAccessService,
  type RequestContext,
} from '@lintel/application';
import {
  type DatabaseConnection,
  findScopeChange,
  listScopeChanges,
  type ScopeChangeView,
} from '@lintel/database';
import { Inject, Injectable } from '@nestjs/common';
import { found } from '../../common/http/access';
import { DATABASE_CONNECTION } from '../../infrastructure/tokens';

/**
 * Scope change responses for one viewer: project access is checked (missing
 * and hidden both 404) and the money terms are left out unless the viewer may
 * see the project's budget.
 */
@Injectable()
export class ScopeChangeReader {
  constructor(
    private readonly access: ProjectAccessService,
    @Inject(DATABASE_CONNECTION) private readonly database: DatabaseConnection,
  ) {}

  async list(context: RequestContext, projectId: string): Promise<ScopeChangeView[]> {
    const access = await this.access.requireView(context.actor, projectId);
    return listScopeChanges(this.database.db, projectId, {
      canSeeMoney: canSeeProjectFinances(context.actor, access),
    });
  }

  async one(context: RequestContext, scopeChangeId: string): Promise<ScopeChangeView> {
    const view = found(
      await findScopeChange(this.database.db, scopeChangeId, { canSeeMoney: false }),
      'Scope change',
    );
    const access = await this.access.requireView(context.actor, view.projectId, 'Scope change');
    if (!canSeeProjectFinances(context.actor, access)) return view;
    return found(
      await findScopeChange(this.database.db, scopeChangeId, { canSeeMoney: true }),
      'Scope change',
    );
  }
}
