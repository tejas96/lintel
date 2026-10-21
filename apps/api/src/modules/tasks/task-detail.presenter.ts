import type { TaskDetail } from '@lintel/api-contracts';
import { canReadFile, TaskViewerQuery } from '@lintel/application';
import { type DatabaseConnection, loadFileAccessFacts, loadTaskDetail } from '@lintel/database';
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
    const clock = await this.business.planningClock();
    const view = found(
      await loadTaskDetail(this.database.db, taskId, clock.now.date, actor.userId, clock),
      'Task',
    );
    // Confidential and private attachments are left out for people who cannot open them,
    // so even their names stay private.
    const facts = await loadFileAccessFacts(
      this.database.db,
      view.attachments.map((file) => file.id),
    );
    const access = { canView: true, canManage: state.viewerCanManage };
    const attachments = view.attachments.filter((file) => {
      const fileFacts = facts.get(file.id);
      return fileFacts !== undefined && canReadFile(fileFacts, actor, access);
    });
    const { workTrackingEnabled } = await this.business.settings();
    return {
      ...view,
      attachments,
      transitions: state.transitions,
      viewerCanManage: state.viewerCanManage,
      viewerCanEdit: state.viewerCanEdit,
      workTrackingEnabled,
    };
  }
}
