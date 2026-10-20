import { integer, timestamp, uuid } from 'drizzle-orm/pg-core';

/** Shared column helpers. Every instant is stored as timestamptz (UTC). */
export const primaryId = () => uuid('id').primaryKey().defaultRandom();
export const createdAt = () =>
  timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow();
export const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow();
export const instant = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
/** Optimistic concurrency: writers send the version they read; mismatches are rejected. */
export const version = () => integer('version').notNull().default(1);
