import {
  createWorkflowTemplatePreset,
  DEFAULT_ROLE_CAPABILITIES,
  PROJECT_TYPES,
  ROLES,
} from '@lintel/domain';
import { eq } from 'drizzle-orm';
import type { Database } from '../client';
import {
  calendarHolidays,
  leaveTypes,
  organizationSettings,
  roleCapabilities,
  teams,
  users,
  workflowTemplates,
  workflowTemplateVersions,
  workingCalendars,
} from '../schema';
import { SEED_HOLIDAYS, SEED_LEAVE_TYPES, SEED_PEOPLE } from './seed-people';

async function seedCalendar(db: Database): Promise<string> {
  let [calendar] = await db
    .select()
    .from(workingCalendars)
    .where(eq(workingCalendars.isDefault, true));
  if (!calendar) {
    [calendar] = await db
      .insert(workingCalendars)
      .values({
        name: 'Studio week (Mon–Sat)',
        timeZone: 'Asia/Kolkata',
        workingWeekdays: [1, 2, 3, 4, 5, 6],
        dayStartTime: '09:30',
        dayEndTime: '18:30',
        workingMinutesPerDay: 480,
        isDefault: true,
      })
      .returning();
  }
  if (!calendar) throw new Error('Could not create the default calendar.');
  const calendarId = calendar.id;
  await db
    .insert(calendarHolidays)
    .values(SEED_HOLIDAYS.map((holiday) => ({ ...holiday, calendarId })))
    .onConflictDoNothing();
  return calendarId;
}

async function seedTeams(db: Database): Promise<Map<string, string>> {
  const teamIds = new Map<string, string>();
  for (const name of ['Leadership', 'Design', 'Site']) {
    await db.insert(teams).values({ name }).onConflictDoNothing();
    const [team] = await db.select().from(teams).where(eq(teams.name, name));
    if (team) teamIds.set(name, team.id);
  }
  return teamIds;
}

async function seedPeople(db: Database, calendarId: string, teamIds: Map<string, string>) {
  const userIds = new Map<string, string>();
  for (const person of SEED_PEOPLE) {
    await db
      .insert(users)
      .values({
        phoneE164: person.phoneE164,
        fullName: person.fullName,
        role: person.role,
        designation: person.designation,
        teamId: teamIds.get(person.team) ?? null,
        workingCalendarId: calendarId,
        avatarHue: person.avatarHue,
      })
      .onConflictDoNothing();
    const [user] = await db.select().from(users).where(eq(users.phoneE164, person.phoneE164));
    if (user) userIds.set(person.key, user.id);
  }
  for (const person of SEED_PEOPLE) {
    const managerId = person.reportsTo ? userIds.get(person.reportsTo) : undefined;
    const userId = userIds.get(person.key);
    if (managerId && userId)
      await db.update(users).set({ reportsToUserId: managerId }).where(eq(users.id, userId));
  }
  return userIds;
}

/** Settings, calendar, roles, people, leave types and templates. Safe to run repeatedly. */
export async function seedFoundation(db: Database): Promise<Map<string, string>> {
  await db
    .insert(organizationSettings)
    .values({ id: 1, name: 'Aranya Design Studio', projectReferencePrefix: 'ARN' })
    .onConflictDoNothing();
  for (const role of ROLES) {
    const rows = DEFAULT_ROLE_CAPABILITIES[role].map((capability) => ({ role, capability }));
    if (rows.length > 0) await db.insert(roleCapabilities).values(rows).onConflictDoNothing();
  }
  const calendarId = await seedCalendar(db);
  const userIds = await seedPeople(db, calendarId, await seedTeams(db));
  await db
    .insert(leaveTypes)
    .values([...SEED_LEAVE_TYPES])
    .onConflictDoNothing();
  await seedTemplates(db, userIds.get('owner') ?? null);
  return userIds;
}

async function seedTemplates(db: Database, ownerId: string | null): Promise<void> {
  const existing = await db.select({ id: workflowTemplates.id }).from(workflowTemplates).limit(1);
  if (existing.length > 0) return;
  for (const projectType of PROJECT_TYPES) {
    const preset = createWorkflowTemplatePreset(projectType);
    const [template] = await db
      .insert(workflowTemplates)
      .values({
        name: preset.name,
        description: preset.description,
        projectType,
        createdByUserId: ownerId,
      })
      .returning();
    if (!template) continue;
    await db.insert(workflowTemplateVersions).values({
      templateId: template.id,
      versionNumber: 1,
      status: 'published',
      definition: preset.definition,
      changeNotes: 'Starter template',
      publishedAt: new Date(),
      publishedByUserId: ownerId,
    });
  }
}
