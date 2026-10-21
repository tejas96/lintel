import {
  buildCapacityRows,
  type InsightSnapshotStore,
  managerHealthScope,
  planCommandCenter,
  STUDIO_HEALTH_SCOPE,
} from '@lintel/application';
import type { Actor } from '@lintel/domain';
import { type CalendarDate, toCalendarDate } from '@lintel/shared';
import { eq } from 'drizzle-orm';
import type { DatabaseExecutor } from '../client';
import { computeBusinessHealth } from '../queries/insights/business-health.query';
import { resolveCommandCenterScope } from '../queries/operations/command-center/command-center-scope';
import type { UtilisationSource } from '../queries/operations/command-center/command-center-team';
import { CapacityReadRepository } from '../repositories/capacity-read.repository';
import { SettingsRepository } from '../repositories/settings.repository';
import { businessHealthSnapshots, projects } from '../schema';

/** The daily run reads the whole studio, like an owner would (no person behind it). */
const STUDIO_READER: Actor = {
  userId: '00000000-0000-0000-0000-000000000000',
  role: 'owner',
  capabilities: new Set(['dashboard.view_business']),
};

/** Capacity rows straight from the repositories (the API uses the CapacityQuery). */
function databaseUtilisation(db: DatabaseExecutor, today: CalendarDate): UtilisationSource {
  const capacity = new CapacityReadRepository(db);
  const settings = new SettingsRepository(db);
  return async (userIds, span) => {
    const range = { start: toCalendarDate(span.start), end: toCalendarDate(span.end) };
    const [people, calendars, leave, tasks] = await Promise.all([
      capacity.people({ userIds, teamId: null }),
      settings.calendarsForUsers(userIds),
      capacity.leaveInRange(userIds, range.start, range.end),
      capacity.openTaskLoads(userIds),
    ]);
    return buildCapacityRows({ people, calendars, leave, tasks, range, today });
  };
}

/** Records the business health score once per scope and day (the command center trend). */
export class InsightSnapshotRepository implements InsightSnapshotStore {
  constructor(private readonly db: DatabaseExecutor) {}

  async recordBusinessHealth(today: CalendarDate, now: Date): Promise<{ recorded: number }> {
    const managers = await this.db
      .selectDistinct({ id: projects.managerUserId })
      .from(projects)
      .where(eq(projects.status, 'active'));
    const scopes = [
      { key: STUDIO_HEALTH_SCOPE, managerUserId: undefined },
      ...managers.map((row) => ({ key: managerHealthScope(row.id), managerUserId: row.id })),
    ];
    const utilisation = databaseUtilisation(this.db, today);
    for (const entry of scopes) {
      const plan = planCommandCenter(
        STUDIO_READER,
        { managerUserId: entry.managerUserId },
        today,
        false,
      );
      const scope = await resolveCommandCenterScope(this.db, plan);
      const { score } = await computeBusinessHealth(this.db, scope, plan, utilisation, now);
      const reading = {
        scopeKey: entry.key,
        recordedOn: today,
        formula: score.formula,
        score: score.score,
        components: score.components.map((part) => ({ ...part })),
      };
      await this.db
        .insert(businessHealthSnapshots)
        .values(reading)
        .onConflictDoUpdate({
          target: [businessHealthSnapshots.scopeKey, businessHealthSnapshots.recordedOn],
          set: {
            formula: reading.formula,
            score: reading.score,
            components: reading.components,
            createdAt: now,
          },
        });
    }
    return { recorded: scopes.length };
  }
}
