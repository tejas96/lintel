import {
  type AnyPgColumn,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, instant, primaryId, updatedAt, version } from './columns';
import { roleEnum, sessionClientEnum, userStatusEnum } from './enums';
import { teams, workingCalendars } from './organization.schema';

export const users = pgTable(
  'users',
  {
    id: primaryId(),
    phoneE164: text('phone_e164').notNull(),
    fullName: text('full_name').notNull(),
    email: text('email'),
    designation: text('designation'),
    role: roleEnum('role').notNull().default('employee'),
    status: userStatusEnum('status').notNull().default('active'),
    teamId: uuid('team_id').references(() => teams.id, { onDelete: 'set null' }),
    reportsToUserId: uuid('reports_to_user_id').references((): AnyPgColumn => users.id, {
      onDelete: 'set null',
    }),
    workingCalendarId: uuid('working_calendar_id').references(() => workingCalendars.id),
    capacityPercent: integer('capacity_percent').notNull().default(100),
    avatarHue: integer('avatar_hue').notNull().default(220),
    quietHoursStart: text('quiet_hours_start'),
    quietHoursEnd: text('quiet_hours_end'),
    lastActiveAt: instant('last_active_at'),
    deactivatedAt: instant('deactivated_at'),
    version: version(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('users_phone_unique').on(table.phoneE164),
    index('users_team_idx').on(table.teamId),
    index('users_reports_to_idx').on(table.reportsToUserId),
  ],
);

/** Capability grants per role. Seeded from domain defaults; editable by administrators. */
export const roleCapabilities = pgTable(
  'role_capabilities',
  {
    role: roleEnum('role').notNull(),
    capability: text('capability').notNull(),
    createdAt: createdAt(),
  },
  (table) => [primaryKey({ columns: [table.role, table.capability] })],
);

/** One sign-in attempt. Only a hash of the code is stored. */
export const otpChallenges = pgTable(
  'otp_challenges',
  {
    id: primaryId(),
    phoneE164: text('phone_e164').notNull(),
    codeHash: text('code_hash').notNull(),
    provider: text('provider').notNull(),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull(),
    expiresAt: instant('expires_at').notNull(),
    consumedAt: instant('consumed_at'),
    invalidatedAt: instant('invalidated_at'),
    requestIpHash: text('request_ip_hash'),
    createdAt: createdAt(),
  },
  (table) => [index('otp_challenges_phone_idx').on(table.phoneE164, table.createdAt)],
);

/** Fixed-window counters for abuse limits that must survive restarts and scale out. */
export const rateLimitCounters = pgTable(
  'rate_limit_counters',
  {
    key: text('key').notNull(),
    windowStart: instant('window_start').notNull(),
    count: integer('count').notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.key, table.windowStart] })],
);

/** Opaque session tokens: the client holds the token, the server stores its SHA-256. */
export const sessions = pgTable(
  'sessions',
  {
    id: primaryId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    client: sessionClientEnum('client').notNull(),
    userAgent: text('user_agent'),
    ipHash: text('ip_hash'),
    lastSeenAt: instant('last_seen_at').notNull().defaultNow(),
    expiresAt: instant('expires_at').notNull(),
    revokedAt: instant('revoked_at'),
    revokedReason: text('revoked_reason'),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('sessions_token_hash_unique').on(table.tokenHash),
    index('sessions_user_idx').on(table.userId),
  ],
);
