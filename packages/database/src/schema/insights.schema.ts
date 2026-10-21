import { date, integer, jsonb, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';
import { createdAt, primaryId } from './columns';

/**
 * One business health reading per scope and day, recorded by the worker's
 * daily run, so the command center can show the score's trend. Scope is
 * "studio" or "manager:<userId>". Components keep the measured inputs and
 * penalties, so a past score can always be explained.
 */
export const businessHealthSnapshots = pgTable(
  'business_health_snapshots',
  {
    id: primaryId(),
    scopeKey: text('scope_key').notNull(),
    recordedOn: date('recorded_on', { mode: 'string' }).notNull(),
    formula: text('formula').notNull(),
    score: integer('score').notNull(),
    components: jsonb('components').$type<Record<string, unknown>[]>().notNull(),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex('business_health_snapshot_unique').on(table.scopeKey, table.recordedOn)],
);
