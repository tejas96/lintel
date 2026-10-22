import { taskOwnershipWindow } from '@lintel/domain';
import { type CalendarDate, type Clock, ForbiddenError, toCalendarDate } from '@lintel/shared';
import type { RequestContext } from '../common/request-context';
import type { ApplicationStores, UnitOfWork } from '../common/unit-of-work';
import { loadTaskForActor } from '../tasks/task-loader';
import { businessToday } from './leave-context';

type Stores = Pick<ApplicationStores, 'access' | 'tasks' | 'settings'>;

export interface TaskAwayWindow {
  readonly taskId: string;
  readonly start: CalendarDate;
  readonly end: CalendarDate;
}

/**
 * The days to check for absences before someone is given a task: whoever may
 * change its owner (a manager or assigner of the project) sees who is away
 * then, so they are warned before handing work to someone on leave. Missing
 * and hidden tasks answer 404; viewers who cannot reassign get 403. Only
 * dates and status are shared, never the leave type or reason.
 */
export class PeopleAwayQuery {
  constructor(
    private readonly uow: UnitOfWork<Stores>,
    private readonly clock: Clock,
  ) {}

  async forTask(context: RequestContext, taskId: string): Promise<TaskAwayWindow> {
    const stores = this.uow.stores;
    const loaded = await loadTaskForActor(stores, context.actor, taskId, false);
    if (!loaded.access.canAssign && !loaded.relation.canManage) {
      throw new ForbiddenError('Only people who can reassign this task see who is away.');
    }
    const today = await businessToday(stores.settings, this.clock);
    const { task } = loaded;
    const window = taskOwnershipWindow(
      {
        plannedStartDate: task.plannedStartDate ? toCalendarDate(task.plannedStartDate) : null,
        dueDate: task.dueDate ? toCalendarDate(task.dueDate) : null,
      },
      today,
    );
    return { taskId: task.id, ...window };
  }
}
