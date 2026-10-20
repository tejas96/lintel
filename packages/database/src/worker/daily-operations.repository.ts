import {
  type DailyOperationsStore,
  MILESTONE_HEALTH_ACTIVITY,
  type ProjectRiskFacts,
} from '@lintel/application';
import type { MilestoneHealth } from '@lintel/domain';
import type { CalendarDate } from '@lintel/shared';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { DatabaseExecutor } from '../client';
import { loadProjectHealth } from '../queries/shared/project-health.loader';
import { activityEvents, milestones, notifications, projects } from '../schema';

const MILESTONE_HEALTHS: ReadonlySet<string> = new Set([
  'completed',
  'on_track',
  'at_risk',
  'missed',
]);

function isMilestoneHealth(value: unknown): value is MilestoneHealth {
  return typeof value === 'string' && MILESTONE_HEALTHS.has(value);
}

/** Facts for the daily risk run. Health comes from the shared domain-based loader. */
export class DailyOperationsRepository implements DailyOperationsStore {
  constructor(private readonly db: DatabaseExecutor) {}

  async activeProjectRisks(today: CalendarDate): Promise<ProjectRiskFacts[]> {
    const rows = await this.db
      .select({
        id: projects.id,
        name: projects.name,
        reference: projects.reference,
        status: projects.status,
        plannedEndDate: projects.plannedEndDate,
        managerUserId: projects.managerUserId,
      })
      .from(projects)
      .where(eq(projects.status, 'active'))
      .orderBy(asc(projects.reference));
    if (rows.length === 0) return [];
    const ids = rows.map((row) => row.id);
    const [health, milestoneRows] = await Promise.all([
      loadProjectHealth(this.db, rows, today),
      this.db
        .select({
          id: milestones.id,
          projectId: milestones.projectId,
          name: milestones.name,
          dueDate: milestones.dueDate,
        })
        .from(milestones)
        .where(inArray(milestones.projectId, ids))
        .orderBy(asc(milestones.dueDate)),
    ]);
    const facts: ProjectRiskFacts[] = [];
    for (const row of rows) {
      const bundle = health.get(row.id);
      if (!bundle) continue;
      facts.push({
        projectId: row.id,
        name: row.name,
        reference: row.reference,
        managerUserId: row.managerUserId,
        health: bundle.health,
        milestones: milestoneRows.flatMap((milestone) => {
          const assessment = bundle.milestoneRisk.get(milestone.id);
          if (milestone.projectId !== row.id || !assessment) return [];
          return [
            { id: milestone.id, name: milestone.name, dueDate: milestone.dueDate, assessment },
          ];
        }),
      });
    }
    return facts;
  }

  async lastRecordedMilestoneHealth(
    milestoneIds: readonly string[],
  ): Promise<Map<string, MilestoneHealth>> {
    const result = new Map<string, MilestoneHealth>();
    if (milestoneIds.length === 0) return result;
    const milestoneId = sql<string>`${activityEvents.payload}->>'milestoneId'`;
    const rows = await this.db
      .selectDistinctOn([milestoneId], {
        milestoneId,
        health: sql<string>`${activityEvents.payload}->>'health'`,
      })
      .from(activityEvents)
      .where(
        and(
          eq(activityEvents.type, MILESTONE_HEALTH_ACTIVITY),
          inArray(milestoneId, [...milestoneIds]),
        ),
      )
      .orderBy(milestoneId, sql`${activityEvents.createdAt} desc`);
    for (const row of rows) {
      if (isMilestoneHealth(row.health)) result.set(row.milestoneId, row.health);
    }
    return result;
  }

  async notificationExists(recipientUserId: string, dedupeKey: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientUserId, recipientUserId),
          eq(notifications.dedupeKey, dedupeKey),
        ),
      )
      .limit(1);
    return Boolean(row);
  }
}
