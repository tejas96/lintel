import { planCommandCenter } from '@lintel/application';
import type { Actor } from '@lintel/domain';
import { toCalendarDate } from '@lintel/shared';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabaseConnection, type DatabaseConnection } from '../client';
import { loadCommandCenterBriefing } from '../queries/insights/briefing.query';
import * as t from '../schema';
import { InsightSnapshotRepository } from './insight-snapshot.repository';

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
// A day long ago, so no other reading in the test database shares it.
const day = toCalendarDate('2024-01-02');
const owner: Actor = {
  userId: '00000000-0000-0000-0000-000000000001',
  role: 'owner',
  capabilities: new Set(['dashboard.view_business']),
};

describe.skipIf(!url)('business health readings (PostgreSQL)', () => {
  let connection: DatabaseConnection;

  beforeAll(() => {
    connection = createDatabaseConnection(url ?? '', { max: 2 });
  });

  afterAll(async () => {
    await connection.db
      .delete(t.businessHealthSnapshots)
      .where(eq(t.businessHealthSnapshots.recordedOn, day));
    await connection.close();
  });

  const studioRows = () =>
    connection.db
      .select()
      .from(t.businessHealthSnapshots)
      .where(
        and(
          eq(t.businessHealthSnapshots.scopeKey, 'studio'),
          eq(t.businessHealthSnapshots.recordedOn, day),
        ),
      );

  it('records one reading per scope and day, and a rerun replaces it', async () => {
    const repository = new InsightSnapshotRepository(connection.db);
    const first = await repository.recordBusinessHealth(day, new Date('2024-01-02T03:00:00Z'));
    expect(first.recorded).toBeGreaterThanOrEqual(1);
    const second = await repository.recordBusinessHealth(day, new Date('2024-01-02T05:00:00Z'));
    expect(second.recorded).toBe(first.recorded);
    const rows = await studioRows();
    expect(rows).toHaveLength(1);
    const [reading] = rows;
    expect(reading?.formula).toBe('health-v1');
    expect(reading?.score).toBeGreaterThanOrEqual(0);
    expect(reading?.score).toBeLessThanOrEqual(100);
    expect(reading?.components).toHaveLength(5);
    expect(reading?.createdAt.toISOString()).toBe('2024-01-02T05:00:00.000Z');
  });

  it('shows the recorded readings as the trend of the studio view', async () => {
    const plan = planCommandCenter(owner, {}, toCalendarDate('2024-01-09'), false);
    const briefing = await loadCommandCenterBriefing(connection.db, plan, {
      timeZone: 'Asia/Kolkata',
      now: new Date('2024-01-09T05:00:00Z'),
      utilisation: async () => [],
    });
    const [reading] = await studioRows();
    expect(briefing.health.trend).toMatchObject({
      scopeKey: 'studio',
      previousOn: '2024-01-02',
      previousScore: reading?.score,
    });
    expect(briefing.health.trend.points.at(-1)).toEqual({
      date: '2024-01-09',
      score: briefing.health.score,
    });
    expect(briefing.deadlines.range).toEqual({ start: '2024-01-10', end: '2024-01-16' });
  });
});
