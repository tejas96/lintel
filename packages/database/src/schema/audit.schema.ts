import { index, integer, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt, instant, primaryId } from './columns';
import { users } from './identity.schema';
import { projects } from './projects.schema';

/** The human-readable project feed ("Asha moved Working drawings to review"). */
export const activityEvents = pgTable(
  'activity_events',
  {
    id: primaryId(),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id'),
    actorUserId: uuid('actor_user_id').references(() => users.id),
    type: text('type').notNull(),
    summary: text('summary').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (table) => [
    index('activity_project_idx').on(table.projectId, table.createdAt),
    index('activity_task_idx').on(table.taskId, table.createdAt),
  ],
);

/** Security and compliance record for sensitive operations. Append-only. */
export const auditLog = pgTable(
  'audit_log',
  {
    id: primaryId(),
    actorUserId: uuid('actor_user_id').references(() => users.id),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    before: jsonb('before').$type<Record<string, unknown>>(),
    after: jsonb('after').$type<Record<string, unknown>>(),
    requestId: text('request_id'),
    ipHash: text('ip_hash'),
    createdAt: createdAt(),
  },
  (table) => [
    index('audit_entity_idx').on(table.entityType, table.entityId),
    index('audit_actor_idx').on(table.actorUserId, table.createdAt),
  ],
);

/**
 * Transactional outbox. Rows are written in the same transaction as the
 * business change; the worker relays them to Temporal at least once.
 */
export const outboxEvents = pgTable(
  'outbox_events',
  {
    id: primaryId(),
    eventType: text('event_type').notNull(),
    aggregateType: text('aggregate_type').notNull(),
    aggregateId: text('aggregate_id').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    occurredAt: createdAt(),
    availableAt: instant('available_at').notNull().defaultNow(),
    processedAt: instant('processed_at'),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
  },
  (table) => [index('outbox_pending_idx').on(table.processedAt, table.availableAt)],
);

/** Responses to retried commands that carried an Idempotency-Key header. */
export const idempotencyRecords = pgTable(
  'idempotency_records',
  {
    id: primaryId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    requestFingerprint: text('request_fingerprint').notNull(),
    responseStatus: integer('response_status').notNull(),
    responseBody: jsonb('response_body').$type<unknown>(),
    createdAt: createdAt(),
    expiresAt: instant('expires_at').notNull(),
  },
  (table) => [uniqueIndex('idempotency_user_key_unique').on(table.userId, table.key)],
);

/** Durable workflows started for business records, for support and recovery. */
export const workflowRuns = pgTable(
  'workflow_runs',
  {
    id: primaryId(),
    workflowType: text('workflow_type').notNull(),
    workflowId: text('workflow_id').notNull(),
    subjectType: text('subject_type').notNull(),
    subjectId: text('subject_id').notNull(),
    sourceEventId: uuid('source_event_id'),
    startedAt: createdAt(),
    lastSignalAt: instant('last_signal_at'),
  },
  (table) => [uniqueIndex('workflow_runs_workflow_id_unique').on(table.workflowId)],
);
