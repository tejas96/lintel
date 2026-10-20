import {
  Notifier,
  type ProjectCommandDependencies,
  type RequestContext,
} from '@lintel/application';
import type { ProjectType } from '@lintel/domain';
import { type CalendarDate, calendarDateInTimeZone, systemClock } from '@lintel/shared';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { Database } from '../../client';
import { users, workflowTemplates, workflowTemplateVersions } from '../../schema';
import { DrizzleUnitOfWork } from '../../unit-of-work';
import { SEED_PEOPLE } from '../seed-people';
import type { DemoPersonKey } from './demo-projects';

export interface DemoContext {
  readonly db: Database;
  readonly deps: ProjectCommandDependencies;
  readonly today: CalendarDate;
  readonly timeZone: string;
  personId(key: DemoPersonKey): string;
  /** A request context for a seeded person, with their role's current capabilities. */
  actingAs(key: DemoPersonKey): Promise<RequestContext>;
  publishedTemplateVersion(projectType: ProjectType): Promise<string | null>;
}

/** Wires the real use cases (same as the API) for the demo seed. */
export async function createDemoContext(db: Database): Promise<DemoContext> {
  const uow = new DrizzleUnitOfWork(db);
  const settings = await uow.stores.settings.organization();
  const ids = new Map<string, string>();
  for (const person of SEED_PEOPLE) {
    const [row] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.phoneE164, person.phoneE164));
    if (row) ids.set(person.key, row.id);
  }
  const personId = (key: DemoPersonKey): string => {
    const id = ids.get(key);
    if (!id) throw new Error(`Seed person "${key}" is missing. Run db:seed first.`);
    return id;
  };
  const deps: ProjectCommandDependencies = {
    uow,
    clock: systemClock,
    notifierFor: async (stores) =>
      new Notifier(stores.notifications, stores.records, systemClock, {
        timeZone: settings.timeZone,
        quietHoursStart: settings.defaultQuietHoursStart,
        quietHoursEnd: settings.defaultQuietHoursEnd,
        smsConfigured: false,
      }),
  };
  return {
    db,
    deps,
    today: calendarDateInTimeZone(systemClock.now(), settings.timeZone),
    timeZone: settings.timeZone,
    personId,
    async actingAs(key) {
      const user = await uow.stores.identity.findUserById(personId(key));
      if (!user) throw new Error(`Seed person "${key}" is missing.`);
      const capabilities = await uow.stores.identity.capabilitiesForRole(user.role);
      return {
        actor: { userId: user.id, role: user.role, capabilities: new Set(capabilities) },
        sessionId: 'demo-seed',
        requestId: 'demo-seed',
      };
    },
    async publishedTemplateVersion(projectType) {
      const [row] = await db
        .select({ id: workflowTemplateVersions.id })
        .from(workflowTemplateVersions)
        .innerJoin(workflowTemplates, eq(workflowTemplates.id, workflowTemplateVersions.templateId))
        .where(
          and(
            eq(workflowTemplates.projectType, projectType),
            isNull(workflowTemplates.archivedAt),
            eq(workflowTemplateVersions.status, 'published'),
          ),
        )
        .orderBy(asc(workflowTemplates.createdAt))
        .limit(1);
      return row?.id ?? null;
    },
  };
}
