import {
  SetUpStudioCommand,
  type SetupStores,
  StudioAlreadySetUpError,
  type StudioSetupInput,
} from '@lintel/application';
import { CAPABILITIES } from '@lintel/domain';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabaseConnection, type DatabaseConnection, type Transaction } from '../src/client';
import { RecordRepository } from '../src/repositories/record.repository';
import { StudioSetupRepository } from '../src/setup/studio-setup.repository';

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

/** Thrown at the end of a test so the outer transaction rolls everything back. */
class RollBack extends Error {}

const input: StudioSetupInput = {
  studioName: 'Saffron Design Studio',
  ownerName: 'Meera Rao',
  ownerPhoneE164: '+919812345678',
  ownerEmail: null,
  timeZone: 'Asia/Kolkata',
  currency: 'INR',
  projectReferencePrefix: 'SDS',
};

function commandIn(tx: Transaction): SetUpStudioCommand {
  const storesFor = (executor: Transaction): SetupStores => ({
    setup: new StudioSetupRepository(executor),
    records: new RecordRepository(executor),
  });
  return new SetUpStudioCommand({
    stores: storesFor(tx),
    transaction: (work) => tx.transaction((inner) => work(storesFor(inner))),
  });
}

/**
 * Runs against an emptied installation inside one transaction that is always
 * rolled back, so the shared test database keeps its seeded studio.
 */
async function onEmptyInstallation(
  connection: DatabaseConnection,
  check: (tx: Transaction) => Promise<void>,
): Promise<void> {
  try {
    await connection.db.transaction(async (tx) => {
      await tx.execute(
        sql`truncate organization_settings, working_calendars, role_capabilities, users, teams, leave_types cascade`,
      );
      await check(tx);
      throw new RollBack();
    });
  } catch (error) {
    if (!(error instanceof RollBack)) throw error;
  }
}

const count = async (tx: Transaction, table: string, where = 'true') => {
  const result = await tx.execute(
    sql.raw(`select count(*)::int as n from ${table} where ${where}`),
  );
  return Number((result.rows[0] as { n: number } | undefined)?.n ?? 0);
};

describe.skipIf(!url)('first-time studio setup against PostgreSQL', () => {
  let connection: DatabaseConnection;

  beforeAll(() => {
    connection = createDatabaseConnection(url ?? '', { max: 2 });
  });

  afterAll(async () => {
    await connection.close();
  });

  it('creates exactly the studio, its week, role access and the owner', async () => {
    await onEmptyInstallation(connection, async (tx) => {
      const result = await commandIn(tx).execute(input);
      expect(await count(tx, 'organization_settings', "name = 'Saffron Design Studio'")).toBe(1);
      expect(await count(tx, 'working_calendars', 'is_default')).toBe(1);
      expect(await count(tx, 'role_capabilities', "role = 'owner'")).toBe(CAPABILITIES.length);
      expect(result.grantsAdded).toBe(await count(tx, 'role_capabilities'));
      expect(await count(tx, 'users')).toBe(1);
      expect(
        await count(
          tx,
          'users',
          `role = 'owner' and phone_e164 = '+919812345678' and working_calendar_id is not null`,
        ),
      ).toBe(1);
      // No demo data: no teams, leave types, templates, projects or holidays.
      for (const table of [
        'teams',
        'leave_types',
        'workflow_templates',
        'projects',
        'calendar_holidays',
      ]) {
        expect(await count(tx, table)).toBe(0);
      }
      expect(await count(tx, 'audit_log', "action = 'studio.set_up'")).toBe(1);
    });
  });

  it('refuses a second run without changing anything', async () => {
    await onEmptyInstallation(connection, async (tx) => {
      await commandIn(tx).execute(input);
      await expect(
        commandIn(tx).execute({
          ...input,
          studioName: 'Second studio',
          ownerPhoneE164: '+919800000099',
        }),
      ).rejects.toBeInstanceOf(StudioAlreadySetUpError);
      expect(await count(tx, 'organization_settings', "name = 'Saffron Design Studio'")).toBe(1);
      expect(await count(tx, 'users')).toBe(1);
      expect(await count(tx, 'working_calendars')).toBe(1);
    });
  });

  it('refuses a seeded installation', async () => {
    const tx = connection.db;
    const before = await tx.execute(sql`select count(*)::int as n from users`);
    await expect(
      new SetUpStudioCommand({
        stores: { setup: new StudioSetupRepository(tx), records: new RecordRepository(tx) },
        transaction: (work) =>
          tx.transaction((inner) =>
            work({ setup: new StudioSetupRepository(inner), records: new RecordRepository(inner) }),
          ),
      }).execute(input),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    const after = await tx.execute(sql`select count(*)::int as n from users`);
    expect(after.rows).toEqual(before.rows);
  });
});
