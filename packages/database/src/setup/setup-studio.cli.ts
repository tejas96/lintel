import { SetUpStudioCommand, type SetupStores, StudioAlreadySetUpError } from '@lintel/application';
import { describeWorkingWeekdays } from '@lintel/domain';
import { isApplicationError, maskPhoneNumber } from '@lintel/shared';
import { createDatabaseConnection, type DatabaseConnection } from '../client';
import { RecordRepository } from '../repositories/record.repository';
import { parseSetupArguments, SETUP_USAGE, SetupArgumentsError } from './setup-studio.arguments';
import { StudioSetupRepository } from './studio-setup.repository';

/** Exit codes: 0 set up, 1 invalid input or failure, 2 already set up (nothing changed). */
const EXIT = { invalid: 1, alreadySetUp: 2 } as const;

function setupCommand(connection: DatabaseConnection): SetUpStudioCommand {
  const storesFor = (executor: DatabaseConnection['db']): SetupStores => ({
    setup: new StudioSetupRepository(executor),
    records: new RecordRepository(executor),
  });
  return new SetUpStudioCommand({
    stores: storesFor(connection.db),
    transaction: (work) => connection.db.transaction((tx) => work(storesFor(tx))),
  });
}

function nextSteps(webAddress: string | undefined): string {
  const address = webAddress ?? 'your Lintel address';
  return `Next steps
  1. Open ${address} and sign in with the owner's mobile number. The code comes by SMS.
  2. Settings, Studio and Holidays: check the details and add this year's holidays.
  3. Settings, Working week: adjust the studio week (Monday to Saturday, 09:30 to 18:30 now).
  4. Settings, Leave: add the leave types your studio offers. There are none yet.
  5. People: add everyone else; each person signs in with their own mobile number.
  6. Templates: start each project type from Lintel's starting point, adjust it and publish.`;
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    console.info(SETUP_USAGE);
    return 0;
  }
  const input = parseSetupArguments(argv, process.env);
  const url = process.env.DATABASE_URL;
  if (!url) throw new SetupArgumentsError(['DATABASE_URL is required.']);
  const connection = createDatabaseConnection(url, { max: 1 });
  try {
    const result = await setupCommand(connection).execute(input);
    const week = result.studioWeek;
    console.info(`Lintel is set up for ${input.studioName}.

  Owner         ${input.ownerName} (${maskPhoneNumber(input.ownerPhoneE164)})
  Time zone     ${input.timeZone}
  Currency      ${input.currency}
  References    ${input.projectReferencePrefix}-${new Date().getUTCFullYear()}-001, -002, …
  Studio week   ${describeWorkingWeekdays(week.workingWeekdays)}, ${week.dayStartTime} to ${week.dayEndTime}
  Role access   ${result.grantsAdded} grants from the defaults (the owner keeps every capability)

${nextSteps(process.env.WEB_BASE_URL)}`);
    return 0;
  } finally {
    await connection.close();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    if (error instanceof SetupArgumentsError) {
      console.error(`Setup did not run:\n  ${error.problems.join('\n  ')}\n\n${SETUP_USAGE}`);
      process.exit(EXIT.invalid);
    }
    if (error instanceof StudioAlreadySetUpError) {
      const reasons = error.details.map((detail) => `  - ${detail.message}`).join('\n');
      console.error(
        `${error.message}\n${reasons}\nTo change the studio, sign in as the owner and use Settings.`,
      );
      process.exit(EXIT.alreadySetUp);
    }
    if (isApplicationError(error)) {
      const details = error.details.map((detail) => `  - ${detail.message}`).join('\n');
      console.error(`Setup did not run: ${error.message}\n${details}`);
      process.exit(EXIT.invalid);
    }
    // Driver messages can embed values; show only the kind of failure.
    console.error('Setup failed:', error instanceof Error ? error.message.split('\n')[0] : error);
    process.exit(EXIT.invalid);
  });
