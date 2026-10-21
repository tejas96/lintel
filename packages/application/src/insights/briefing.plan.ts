import { addDays, type CalendarDate } from '@lintel/shared';
import type { CommandCenterPlan, CommandCenterSpan } from '../operations/command-center.plan';

/** "Deadlines in the next 7 days": tomorrow through a week from today (today has its own count). */
export const DEADLINE_WINDOW_DAYS = 7;
export const RISK_CARD_LIMIT = 6;
export const HIGHLIGHT_LIMIT = 6;
export const INTERVENTION_LIMIT = 8;
/** Days of recorded health readings shown as the trend. */
export const HEALTH_TREND_DAYS = 56;

export function deadlineWindow(today: CalendarDate): CommandCenterSpan {
  return { start: addDays(today, 1), end: addDays(today, DEADLINE_WINDOW_DAYS) };
}

/** Health readings are recorded for the whole studio and for each project manager's projects. */
export const STUDIO_HEALTH_SCOPE = 'studio';

export function managerHealthScope(userId: string): string {
  return `manager:${userId}`;
}

/**
 * The recorded reading that matches a command center view, if any: the
 * studio view, or one manager's projects (their own view, or the studio view
 * filtered to that manager). Project and team filters have no recorded
 * trend; the live score still follows them.
 */
export function healthScopeKey(plan: CommandCenterPlan): string | null {
  if (plan.projectId || plan.teamId) return null;
  if (plan.managerUserId) return managerHealthScope(plan.managerUserId);
  return plan.scope === 'business' ? STUDIO_HEALTH_SCOPE : null;
}
