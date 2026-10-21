import { pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';
import { instant } from './columns';
import { users } from './identity.schema';

/**
 * First-run tips a person has already seen, so each shows once across every
 * device. Keys are validated by the API ("today", "task", …); deleting a
 * person's rows shows the tips again.
 */
export const userGuidanceTips = pgTable(
  'user_guidance_tips',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tipKey: text('tip_key').notNull(),
    seenAt: instant('seen_at').notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.tipKey] })],
);
