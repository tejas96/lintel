import { type CalendarDate, toCalendarDate } from '@lintel/shared';
import type { WorkingCalendar } from '../calendar/working-calendar';
import { assessProjectSchedule } from '../projects/project-schedule-health';
import type { TaskDependencyEdge } from '../tasks/task-dependency-graph';
import type {
  RiskCommitment,
  RiskContext,
  RiskProjectFacts,
  RiskTaskFacts,
} from './risk-card.types';

/** Monday to Friday, 09:30–18:30 in India (UTC+05:30), no holidays. */
export const WEEKDAY_CALENDAR: WorkingCalendar = {
  timeZone: 'Asia/Kolkata',
  workingWeekdays: [1, 2, 3, 4, 5],
  dayStartTime: '09:30',
  dayEndTime: '18:30',
  workingMinutesPerDay: 480,
  holidays: new Set(),
};

export const date = (value: string): CalendarDate => toCalendarDate(value);

/** Wednesday 21 October 2026, 11:30 in India. */
export const RISK_CONTEXT: RiskContext = {
  today: date('2026-10-21'),
  now: new Date('2026-10-21T06:00:00.000Z'),
  calendar: WEEKDAY_CALENDAR,
  reminderTime: '10:00',
};

export function riskTask(id: string, overrides: Partial<RiskTaskFacts> = {}): RiskTaskFacts {
  return {
    id,
    title: `Task ${id}`,
    status: 'in_progress',
    priority: 'medium',
    ownerUserId: 'meera',
    reviewerUserId: 'rohan',
    plannedStartDate: null,
    dueDate: date('2026-10-28'),
    escalateAfterOverdueDays: 1,
    submittedAt: null,
    openBlocker: null,
    openDateRequest: null,
    ownerAway: null,
    ...overrides,
  };
}

/** Milestone "m1" with its health from the production rules (§6), on the same forecast. */
export function riskMilestone(
  dueDate: string,
  tasks: readonly RiskTaskFacts[],
  linked: readonly string[] = tasks.map((task) => task.id),
  dependencies: readonly TaskDependencyEdge[] = [],
): RiskCommitment {
  const { milestoneRisk } = assessProjectSchedule(
    {
      status: 'active',
      plannedEndDate: null,
      tasks: tasks.map((task) => ({
        ...task,
        hasOpenBlocker: task.openBlocker !== null,
        milestoneId: linked.includes(task.id) ? 'm1' : null,
      })),
      dependencies,
      milestones: [
        { id: 'm1', name: 'Concept approved', status: 'pending', dueDate: date(dueDate) },
      ],
      openBlockerAgesInDays: [],
    },
    RISK_CONTEXT.calendar,
    RISK_CONTEXT.today,
  );
  return {
    kind: 'milestone',
    id: 'm1',
    name: 'Concept approved',
    dueDate: date(dueDate),
    health: milestoneRisk.get('m1')?.health ?? null,
    taskIds: linked,
  };
}

export function riskProject(
  tasks: readonly RiskTaskFacts[],
  commitments: readonly RiskCommitment[],
  overrides: Partial<RiskProjectFacts> = {},
): RiskProjectFacts {
  return {
    id: 'p1',
    criticality: 'normal',
    managerUserId: 'pm',
    commitments,
    tasks,
    dependencies: [],
    ...overrides,
  };
}
