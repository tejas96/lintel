import {
  addWorkload,
  type ReportPlan,
  spreadPlannedWork,
  summarizeWorkload,
  sumWorkload,
  type WorkloadMinutes,
  workloadByDay,
  workloadByPeriod,
} from '@lintel/application';
import { DEFAULT_TASK_ESTIMATE_MINUTES, DEFAULT_WORKING_CALENDAR } from '@lintel/domain';
import type { DatabaseExecutor } from '../../client';
import { CapacityReadRepository } from '../../repositories/capacity-read.repository';
import { SettingsRepository } from '../../repositories/settings.repository';
import type { ReportSources } from './delivery-report.query';
import { resolveReportScope, scopePeople } from './report-scope';
import { loadWorkFacts } from './workload-facts';

export interface WorkloadReportSources extends ReportSources {
  readonly workTrackingEnabled: boolean;
}

const NONE: WorkloadMinutes = { available: 0, planned: 0, tentative: 0, logged: 0 };

/**
 * Workload and capacity over the range for active people in scope: available,
 * planned, tentative and logged hours per person, per team and per period.
 * Formulas: `workload-report.metrics.ts` (application). When the report is
 * limited to some projects, only their tasks and logged time count as work.
 */
export async function loadWorkloadReport(
  db: DatabaseExecutor,
  plan: ReportPlan,
  sources: WorkloadReportSources,
) {
  const scope = await resolveReportScope(db, plan);
  const people = await new CapacityReadRepository(db).people({
    userIds: await scopePeople(db, scope, { activeOnly: true }),
    teamId: null,
  });
  const userIds = people.map((person) => person.user.id);
  const calendars = await new SettingsRepository(db).calendarsForUsers(userIds);
  const facts = await loadWorkFacts(db, plan, scope, userIds, calendars, sources.timeZone);
  const periodTotals = plan.periods.map(() => NONE);
  const teams = new Map<
    string,
    { team: { id: string; name: string } | null; people: number; minutes: WorkloadMinutes }
  >();
  const rows = people.map((person) => {
    const calendar = calendars.get(person.user.id) ?? DEFAULT_WORKING_CALENDAR;
    const work = facts.get(person.user.id) ?? { tasks: [], sessions: [], approvedLeave: [] };
    const days = workloadByDay(
      { calendar, capacityPercent: person.capacityPercent, ...work },
      plan.range,
    );
    const minutes = sumWorkload(days.values());
    workloadByPeriod(days, plan.periods).forEach((period, index) => {
      periodTotals[index] = addWorkload(periodTotals[index] ?? NONE, period);
    });
    const teamKey = person.teamId ?? 'none';
    const current = teams.get(teamKey);
    teams.set(teamKey, {
      team: person.teamId && person.teamName ? { id: person.teamId, name: person.teamName } : null,
      people: (current?.people ?? 0) + 1,
      minutes: addWorkload(current?.minutes ?? NONE, minutes),
    });
    const inRange = work.tasks.filter((task) =>
      [...spreadPlannedWork(task, calendar).keys()].some(
        (date) => date >= plan.range.start && date <= plan.range.end,
      ),
    );
    return {
      ...summarizeWorkload(minutes),
      user: person.user,
      team: person.teamName,
      scheduledTasks: inRange.length,
      tasksWithoutEstimate: inRange.filter((task) => !task.hasEstimate).length,
      leaveDays: work.approvedLeave.reduce((total, day) => total + day.halfDayUnits, 0) / 2,
    };
  });
  return {
    generatedAt: sources.now.toISOString(),
    scope: plan.scope,
    range: { start: plan.range.start, end: plan.range.end },
    granularity: plan.granularity,
    totals: summarizeWorkload(sumWorkload([...teams.values()].map((team) => team.minutes))),
    byPeriod: plan.periods.map((period, index) => ({
      start: period.start,
      end: period.end,
      ...summarizeWorkload(periodTotals[index] ?? NONE),
    })),
    byPerson: rows,
    byTeam: [...teams.values()]
      .map((entry) => ({
        ...summarizeWorkload(entry.minutes),
        team: entry.team,
        people: entry.people,
      }))
      .sort((left, right) => (left.team?.name ?? '~').localeCompare(right.team?.name ?? '~')),
    defaultEstimateMinutes: DEFAULT_TASK_ESTIMATE_MINUTES,
    workTrackingEnabled: sources.workTrackingEnabled,
    coversAllProjects: scope.allProjects,
  };
}
