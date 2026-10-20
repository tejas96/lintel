import type { TaskDetail } from '@lintel/api-contracts';
import { TaskViewerQuery } from '@lintel/application';
import { type DatabaseConnection, loadTaskDetail } from '@lintel/database';
import type { Actor } from '@lintel/domain';
import { Inject, Injectable } from '@nestjs/common';
import { found } from '../../common/http/access';
import { BusinessContextService } from '../../infrastructure/business-context.service';
import { DATABASE_CONNECTION } from '../../infrastructure/tokens';

/**
 * Builds the TaskDetail response: the read model's view plus what the viewer
 * may do (transitions with reasons, manage/edit rights) from the application.
 */
@Injectable()
export class TaskDetailPresenter {
  constructor(
    private readonly viewer: TaskViewerQuery,
    private readonly business: BusinessContextService,
    @Inject(DATABASE_CONNECTION) private readonly database: DatabaseConnection,
  ) {}

  async detail(actor: Actor, taskId: string): Promise<TaskDetail> {
    const state = await this.viewer.execute(actor, taskId);
    const today = await this.business.today();
    const view = found(await loadTaskDetail(this.database.db, taskId, today, actor.userId), 'Task');
    return {
      ...view,
      transitions: state.transitions,
      viewerCanManage: state.viewerCanManage,
      viewerCanEdit: state.viewerCanEdit,
    };
  }
}
