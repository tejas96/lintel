import {
  type CoverSuggestion,
  type CoverWindow,
  coverNeedMinutes,
  coverWindow,
  DEFAULT_WORKING_CALENDAR,
  type ProjectRole,
  suggestCover,
} from '@lintel/domain';
import {
  type CalendarDate,
  type Clock,
  maxCalendarDate,
  minCalendarDate,
  toCalendarDate,
} from '@lintel/shared';
import { ProjectAccessService } from '../access/project-access.service';
import type { RequestContext } from '../common/request-context';
import type { ApplicationStores, UnitOfWork } from '../common/unit-of-work';
import type { CoverPoolRecord } from '../operations/capacity.store';
import { buildCapacityRows, type CapacityRow, toTaskLoad } from '../operations/capacity-loads';
import type { LeaveQueries } from './leave.queries';
import type { HandoverStatus, LeaveRequestRecord, LeaveWorkItem } from './leave.store';
import { businessToday } from './leave-context';

export interface CoverTaskSuggestions {
  readonly taskId: string;
  readonly projectId: string;
  readonly window: CoverWindow;
  readonly remainingMinutes: number;
  /** The share of that effort planned in the cover window. */
  readonly needMinutes: number;
  /** The handover already proposed for this task on the request, if any. */
  readonly handover: {
    readonly id: string;
    readonly toUserId: string | null;
    readonly status: HandoverStatus;
  } | null;
  readonly suggestions: readonly CoverSuggestion[];
}

export interface CoverSuggestionsResult {
  readonly leaveRequestId: string;
  readonly absentUserId: string;
  readonly tasks: readonly CoverTaskSuggestions[];
}

type Stores = Pick<ApplicationStores, 'access' | 'capacity' | 'settings'>;

/** Leave that still needs cover: waiting for a decision, or approved (urgent absences included). */
const NEEDS_COVER = new Set(['pending', 'info_requested', 'approved']);

function roleOn(person: CoverPoolRecord | undefined, projectId: string): ProjectRole | null {
  return person?.projectRoles.find((entry) => entry.projectId === projectId)?.role ?? null;
}

function windowFacts(row: CapacityRow | undefined, window: CoverWindow) {
  const days = (row?.days ?? []).filter(
    (day) => day.date >= window.start && day.date <= window.end,
  );
  const available = days.reduce((sum, day) => sum + day.availableMinutes, 0);
  const committed = days.reduce((sum, day) => sum + day.confirmedMinutes + day.blockedMinutes, 0);
  return {
    availableMinutes: available,
    freeMinutes: available - committed,
    awayInWindow: days.some((day) => day.leave !== null),
  };
}

/**
 * Who could take each task affected by a leave request or an urgent absence
 * (strategy cover-v1 in the domain). Only tasks on projects the viewer
 * manages are included: choosing cover is the manager's call, and free time
 * is shown only to them. Nothing is ever reassigned here; the apps open the
 * existing assign or handover flow with the chosen person.
 */
export class CoverSuggestionsQuery {
  constructor(
    private readonly uow: UnitOfWork<Stores>,
    private readonly clock: Clock,
    private readonly leave: LeaveQueries,
  ) {}

  async forLeaveRequest(
    context: RequestContext,
    leaveRequestId: string,
  ): Promise<CoverSuggestionsResult> {
    const access = await this.leave.detail(context, leaveRequestId);
    const { request } = access;
    const empty = { leaveRequestId, absentUserId: request.userId, tasks: [] };
    if (!NEEDS_COVER.has(request.status)) return empty;
    const stores = this.uow.stores;
    const service = new ProjectAccessService(stores.access);
    const managed: LeaveWorkItem[] = [];
    for (const item of access.impact.affectedWork) {
      if ((await service.evaluate(context.actor, item.projectId)).canManage) managed.push(item);
    }
    if (managed.length === 0) return empty;
    const today = await businessToday(stores.settings, this.clock);
    return { ...empty, tasks: await this.suggest(stores, request, managed, today) };
  }

  private async suggest(
    stores: Stores,
    request: LeaveRequestRecord,
    tasks: readonly LeaveWorkItem[],
    today: CalendarDate,
  ): Promise<CoverTaskSuggestions[]> {
    const leave = { start: request.startDate, end: request.endDate };
    const windows = new Map(
      tasks.map((task) => [
        task.taskId,
        coverWindow(
          { plannedStartDate: task.plannedStartDate, dueDate: task.dueDate },
          leave,
          today,
        ),
      ]),
    );
    const span = [...windows.values()].reduce((all, window) => ({
      start: minCalendarDate(all.start, window.start),
      end: maxCalendarDate(all.end, window.end),
    }));
    const absentPeople = await stores.capacity.people({ userIds: [request.userId], teamId: null });
    const absentDesignation = absentPeople[0]?.user.designation ?? null;
    const pool = await stores.capacity.coverPool({
      projectIds: [...new Set(tasks.map((task) => task.projectId))],
      designation: absentDesignation,
      includeUserId: request.userId,
    });
    const poolById = new Map(pool.map((person) => [person.userId, person]));
    const userIds = pool.map((person) => person.userId);
    const [people, calendars, leaveRecords, loads] = await Promise.all([
      stores.capacity.people({ userIds, teamId: null }),
      stores.settings.calendarsForUsers(userIds),
      stores.capacity.leaveInRange(userIds, span.start, span.end),
      stores.capacity.openTaskLoads(userIds),
    ]);
    const rows = new Map(
      buildCapacityRows({
        people,
        calendars,
        leave: leaveRecords,
        tasks: loads,
        range: span,
        today,
      }).map((row) => [row.user.id, row]),
    );
    return tasks.map((task) => {
      const window = windows.get(task.taskId) ?? span;
      const load = loads.find((candidate) => candidate.taskId === task.taskId);
      const remainingMinutes = load ? toTaskLoad(load).remainingMinutes : 0;
      const needMinutes = coverNeedMinutes(
        remainingMinutes,
        { plannedStartDate: task.plannedStartDate, dueDate: task.dueDate },
        window,
        calendars.get(request.userId) ?? DEFAULT_WORKING_CALENDAR,
        today,
      );
      const handover = request.handovers.find((item) => item.taskId === task.taskId) ?? null;
      const absent = poolById.get(request.userId);
      const suggestions = suggestCover(
        { reviewerUserId: load?.reviewerUserId ?? null, needMinutes },
        {
          userId: request.userId,
          designation: absentDesignation,
          projectRole: roleOn(absent, task.projectId),
        },
        pool.map((person) => ({
          userId: person.userId,
          designation: person.designation,
          projectRole: roleOn(person, task.projectId),
          ...windowFacts(rows.get(person.userId), window),
        })),
      );
      return {
        taskId: task.taskId,
        projectId: task.projectId,
        window: { start: toCalendarDate(window.start), end: toCalendarDate(window.end) },
        remainingMinutes,
        needMinutes,
        handover: handover
          ? { id: handover.id, toUserId: handover.toUserId, status: handover.status }
          : null,
        suggestions,
      };
    });
  }
}
