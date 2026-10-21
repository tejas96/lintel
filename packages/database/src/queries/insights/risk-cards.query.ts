import {
  buildProjectRiskCards,
  compareRiskCards,
  forecastDelivery,
  type ResponsibleRole,
  type RiskCard,
  type RiskContext,
  type RiskLinkTarget,
  type RiskRule,
} from '@lintel/domain';
import type { CalendarDate } from '@lintel/shared';
import { inArray } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { SettingsRepository } from '../../repositories/settings.repository';
import { tasks } from '../../schema';
import { loadUserSummaries, pickUser } from '../shared/user-summary.query';
import type { ProjectRefView, TaskRefView, UserSummaryView } from '../shared/view-types';
import { loadTaskRefs } from '../tasks/task-ref.query';
import { loadRiskFacts } from './risk-facts.loader';

export interface RiskCardView {
  readonly key: string;
  readonly rule: RiskRule;
  readonly severity: 'risk' | 'critical';
  readonly project: ProjectRefView;
  readonly commitment: RiskCard['commitment'];
  readonly task: TaskRefView | null;
  readonly happening: string;
  readonly impact: RiskCard['impact'];
  readonly alsoAffects: RiskCard['alsoAffects'][number][];
  readonly nextAction: { readonly label: string; readonly linkPath: string };
  readonly responsible: { readonly role: ResponsibleRole; readonly user: UserSummaryView | null };
  readonly escalation: {
    readonly audience: 'reviewer' | 'project_manager' | 'business_owner';
    readonly at: string;
    readonly alreadyHappened: boolean;
    readonly summary: string;
  } | null;
}

export function linkPathOf(target: RiskLinkTarget): string {
  switch (target.kind) {
    case 'task':
      return `/tasks/${target.id}`;
    case 'date_request':
      return `/tasks/${target.taskId}?dateRequest=${target.id}`;
    case 'leave':
      return `/leave/${target.id}`;
    case 'project':
      return `/projects/${target.id}`;
  }
}

/** The studio calendar and reminder time the escalation timelines run on. */
export async function riskContextFor(
  db: DatabaseExecutor,
  today: CalendarDate,
  now: Date,
): Promise<RiskContext> {
  const settings = new SettingsRepository(db);
  const [calendar, organization] = await Promise.all([
    settings.defaultCalendar(),
    settings.organization(),
  ]);
  return { today, now, calendar, reminderTime: organization.deadlineReminderTime };
}

/**
 * Risk cards for the given projects (rules in the domain, §15.2 of the
 * product requirements), most pressing first, as contract-ready views.
 * Callers pass only projects the viewer may see.
 */
export async function loadRiskCards(
  db: DatabaseExecutor,
  projectIds: readonly string[],
  context: RiskContext,
): Promise<RiskCardView[]> {
  const { projects, facts } = await loadRiskFacts(db, projectIds, context.today, context.calendar);
  return toRiskCardViews(db, projects, facts, context);
}

/** One project's cards and its delivery forecast (the control room). */
export async function loadProjectRisks(
  db: DatabaseExecutor,
  projectId: string,
  context: RiskContext,
) {
  const { projects, facts } = await loadRiskFacts(db, [projectId], context.today, context.calendar);
  const project = facts[0];
  const delivery = project ? forecastDelivery(project, context) : null;
  const commitment = project?.commitments.find((item) => item.kind === 'delivery');
  return {
    cards: await toRiskCardViews(db, projects, facts, context),
    delivery: delivery && commitment ? { dueDate: commitment.dueDate, ...delivery } : null,
  };
}

async function toRiskCardViews(
  db: DatabaseExecutor,
  projects: Awaited<ReturnType<typeof loadRiskFacts>>['projects'],
  facts: Awaited<ReturnType<typeof loadRiskFacts>>['facts'],
  context: RiskContext,
): Promise<RiskCardView[]> {
  const cards = facts
    .flatMap((project) => buildProjectRiskCards(project, context))
    .sort(compareRiskCards);
  if (cards.length === 0) return [];
  const taskIds = cards.flatMap((card) => (card.task ? [card.task.id] : []));
  const [people, refs] = await Promise.all([
    loadUserSummaries(
      db,
      cards.map((card) => card.responsible.userId),
    ),
    taskIds.length > 0 ? loadTaskRefs(db, inArray(tasks.id, taskIds)) : Promise.resolve([]),
  ]);
  return cards.flatMap((card) => {
    const project = projects.find((row) => row.id === card.projectId);
    if (!project) return [];
    return [
      {
        key: card.key,
        rule: card.rule,
        severity: card.severity,
        project: {
          id: project.id,
          reference: project.reference,
          name: project.name,
          colorIndex: project.colorIndex,
        },
        commitment: card.commitment,
        task: card.task ? (refs.find((ref) => ref.id === card.task?.id) ?? null) : null,
        happening: card.happening,
        impact: card.impact,
        alsoAffects: [...card.alsoAffects],
        nextAction: { label: card.nextAction.label, linkPath: linkPathOf(card.nextAction.target) },
        responsible: {
          role: card.responsible.role,
          user: pickUser(people, card.responsible.userId),
        },
        escalation: card.escalation
          ? { ...card.escalation, at: card.escalation.at.toISOString() }
          : null,
      },
    ];
  });
}
