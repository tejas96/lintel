import { DEFAULT_TASK_ESTIMATE_MINUTES } from '@lintel/domain';
import {
  type CalendarDate,
  type Clock,
  calendarDateInTimeZone,
  daysBetween,
  toCalendarDate,
  ValidationFailedError,
} from '@lintel/shared';
import type { RequestContext } from '../common/request-context';
import type { ApplicationStores, UnitOfWork } from '../common/unit-of-work';
import type { CapacityPersonRecord } from './capacity.store';
import { buildCapacityRows, type CapacityRow } from './capacity-loads';

export type CapacityStores = Pick<ApplicationStores, 'capacity' | 'people' | 'settings'>;

/** Longest range one capacity view may cover. */
export const MAX_CAPACITY_RANGE_DAYS = 62;

export interface CapacityOverviewResult {
  readonly start: CalendarDate;
  readonly end: CalendarDate;
  readonly people: CapacityRow[];
  readonly holidays: { date: string; name: string }[];
  readonly defaultEstimateMinutes: number;
}

/** Who a viewer may see: `null` = everyone, otherwise these people only. */
export type CapacityAudience = readonly string[] | null;

/**
 * Workload against availability. Visibility: `capacity.view_all` sees
 * everyone (optionally one team), `capacity.view_team` sees their team and
 * direct reports, everyone else sees only themselves.
 */
export class CapacityQuery {
  constructor(
    private readonly uow: UnitOfWork<CapacityStores>,
    private readonly clock: Clock,
  ) {}

  async audienceOf(context: RequestContext): Promise<CapacityAudience> {
    const { actor } = context;
    if (actor.capabilities.has('capacity.view_all')) return null;
    if (!actor.capabilities.has('capacity.view_team')) return [actor.userId];
    const stores = this.uow.stores;
    const viewer = await stores.people.findById(actor.userId);
    const [team, reports] = await Promise.all([
      viewer?.teamId ? stores.capacity.teamMemberIds(viewer.teamId) : Promise.resolve([]),
      stores.capacity.directReportIds(actor.userId),
    ]);
    return [...new Set([actor.userId, ...team, ...reports])];
  }

  async execute(
    context: RequestContext,
    input: { from: string; to: string; teamId?: string | undefined },
  ): Promise<CapacityOverviewResult> {
    const range = { start: toCalendarDate(input.from), end: toCalendarDate(input.to) };
    const length = daysBetween(range.start, range.end) + 1;
    if (length < 1 || length > MAX_CAPACITY_RANGE_DAYS) {
      throw new ValidationFailedError(
        `Choose a range of 1 to ${MAX_CAPACITY_RANGE_DAYS} days, ending on or after its start.`,
        [{ field: 'to', message: `At most ${MAX_CAPACITY_RANGE_DAYS} days.` }],
      );
    }
    const audience = await this.audienceOf(context);
    const people = await this.uow.stores.capacity.people({
      userIds: audience,
      teamId: input.teamId ?? null,
    });
    const [rows, holidays] = await Promise.all([
      this.rowsFor(people, range),
      this.uow.stores.settings.listHolidays(),
    ]);
    return {
      ...range,
      people: rows,
      holidays: holidays
        .filter((holiday) => holiday.date >= range.start && holiday.date <= range.end)
        .map((holiday) => ({ date: holiday.date, name: holiday.name })),
      defaultEstimateMinutes: DEFAULT_TASK_ESTIMATE_MINUTES,
    };
  }

  /** Capacity rows for chosen people (used by the command center for this week's load). */
  async rowsForUsers(
    userIds: readonly string[],
    range: { start: CalendarDate; end: CalendarDate },
  ): Promise<CapacityRow[]> {
    if (userIds.length === 0) return [];
    const people = await this.uow.stores.capacity.people({ userIds, teamId: null });
    return this.rowsFor(people, range);
  }

  private async rowsFor(
    people: readonly CapacityPersonRecord[],
    range: { start: CalendarDate; end: CalendarDate },
  ): Promise<CapacityRow[]> {
    if (people.length === 0) return [];
    const stores = this.uow.stores;
    const userIds = people.map((person) => person.user.id);
    const [calendars, leave, tasks, organization] = await Promise.all([
      stores.settings.calendarsForUsers(userIds),
      stores.capacity.leaveInRange(userIds, range.start, range.end),
      stores.capacity.openTaskLoads(userIds),
      stores.settings.organization(),
    ]);
    const today = calendarDateInTimeZone(this.clock.now(), organization.timeZone);
    return buildCapacityRows({ people, calendars, leave, tasks, range, today });
  }
}
