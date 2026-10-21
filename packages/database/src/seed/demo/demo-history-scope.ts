import {
  addDays,
  type CalendarDate,
  maxCalendarDate,
  minCalendarDate,
  toCalendarDate,
} from '@lintel/shared';
import { activityEvents, scopeChangeRequests } from '../../schema';
import type { DemoContext } from './demo-context';
import type { HistoryProject } from './demo-history-projects';
import { type HistoryClock, plusHours } from './demo-history-time';
import type { DemoPersonKey } from './demo-projects';

interface ScopeDecisionPlan {
  readonly project: string;
  readonly title: string;
  readonly description: string;
  readonly requester: DemoPersonKey;
  readonly proposedDaysAgo: number;
  readonly decisionHours: number;
  readonly outcome: 'approved' | 'rejected';
  readonly note: string;
}

/**
 * Decided scope changes with no schedule impact, so no dates move. The
 * owner decides each one; requesters are members of the project.
 */
const DECIDED_SCOPE_CHANGES: readonly ScopeDecisionPlan[] = [
  {
    project: 'Tamarind Studio Pavilion',
    title: 'Add a rooftop rainwater harvesting tank',
    description:
      'The client asked for a 5,000-litre tank on the studio roof; the structure allows it.',
    requester: 'architect',
    proposedDaysAgo: 55,
    decisionHours: 20,
    outcome: 'approved',
    note: 'Approved. No change to the drawing issue dates.',
  },
  {
    project: 'Kiln & Co. Café',
    title: 'Upgrade the counter top to quartz',
    description:
      'The client prefers quartz over granite for the show-kitchen counter; same lead time.',
    requester: 'designer2',
    proposedDaysAgo: 30,
    decisionHours: 4.5,
    outcome: 'approved',
    note: 'Approved within the current budget and dates.',
  },
  {
    project: 'Banyan Court Villa',
    title: 'Add a basement wine cellar',
    description: 'The client asked whether a small cellar could go under the courtyard.',
    requester: 'architect',
    proposedDaysAgo: 18,
    decisionHours: 26,
    outcome: 'rejected',
    note: 'Not at this stage: it needs a structural redesign and a fresh permit. Let us revisit after approval.',
  },
  {
    project: 'Tidewater Offices',
    title: 'Add two phone booths near the pantry',
    description: 'The client wants two acoustic booths carved out of the pantry corner.',
    requester: 'designer1',
    proposedDaysAgo: 5,
    decisionHours: 46,
    outcome: 'approved',
    note: 'Approved. Fits inside the current layout and schedule.',
  },
];

/** The proposal day, kept inside the project's life and at least three days ago. */
function proposalDay(plan: ScopeDecisionPlan, project: HistoryProject, clock: HistoryClock) {
  const wanted = addDays(clock.today, -plan.proposedDaysAgo);
  const latest: CalendarDate = minCalendarDate(
    toCalendarDate(project.plannedEndDate),
    addDays(clock.today, -3),
  );
  return minCalendarDate(maxCalendarDate(wanted, toCalendarDate(project.plannedStartDate)), latest);
}

/** Writes the requests and the same feed entries the scope change use cases write. */
export async function seedScopeChangeHistory(
  context: DemoContext,
  clock: HistoryClock,
  scope: readonly HistoryProject[],
): Promise<number> {
  const ownerId = context.personId('owner');
  let written = 0;
  for (const plan of DECIDED_SCOPE_CHANGES) {
    const project = scope.find((candidate) => candidate.name === plan.project);
    if (!project) continue;
    const requesterId = context.personId(plan.requester);
    const proposedAt = clock.past(clock.at(proposalDay(plan, project, clock), '11:40'));
    const decidedAt = clock.past(plusHours(proposedAt, plan.decisionHours));
    const [change] = await context.db
      .insert(scopeChangeRequests)
      .values({
        projectId: project.id,
        title: plan.title,
        description: plan.description,
        status: plan.outcome,
        requestedByUserId: requesterId,
        decidedByUserId: ownerId,
        decidedAt,
        decisionNote: plan.note,
        projectEndImpactDays: 0,
        version: 2,
        createdAt: proposedAt,
        updatedAt: decidedAt,
      })
      .returning({ id: scopeChangeRequests.id });
    if (!change) continue;
    const decided =
      plan.outcome === 'approved'
        ? `Scope change "${plan.title}" approved. 0 task(s) rescheduled.`
        : `Scope change "${plan.title}" rejected.`;
    await context.db.insert(activityEvents).values([
      {
        projectId: project.id,
        taskId: null,
        actorUserId: requesterId,
        type: 'scope_change.proposed',
        summary: `Proposed scope change "${plan.title}" affecting 0 task(s).`,
        payload: { scopeChangeId: change.id, projectEndImpactDays: 0 },
        createdAt: proposedAt,
      },
      {
        projectId: project.id,
        taskId: null,
        actorUserId: ownerId,
        type: `scope_change.${plan.outcome}`,
        summary: decided,
        payload: { scopeChangeId: change.id, note: plan.note, movedCount: 0 },
        createdAt: decidedAt,
      },
    ]);
    written += 1;
  }
  return written;
}
