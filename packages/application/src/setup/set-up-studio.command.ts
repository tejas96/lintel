import {
  DEFAULT_ROLE_CAPABILITIES,
  DEFAULT_WORKING_CALENDAR,
  ROLES,
  validateWorkingWeek,
  type WorkingWeek,
} from '@lintel/domain';
import {
  ConflictError,
  isPhoneNumberE164,
  isValidTimeZone,
  ValidationFailedError,
} from '@lintel/shared';
import type { RecordStore } from '../common/record.store';
import type { UnitOfWork } from '../common/unit-of-work';
import type { StudioSetupState, StudioSetupStore } from './studio-setup.store';

export interface StudioSetupInput {
  readonly studioName: string;
  readonly ownerName: string;
  readonly ownerPhoneE164: string;
  readonly ownerEmail: string | null;
  readonly timeZone: string;
  readonly currency: string;
  readonly projectReferencePrefix: string;
}

export interface StudioSetupResult {
  readonly ownerUserId: string;
  readonly calendarId: string;
  readonly studioWeek: WorkingWeek;
  readonly grantsAdded: number;
}

export interface SetupStores {
  readonly setup: StudioSetupStore;
  readonly records: RecordStore;
}

/** The installation already has a studio; setup changed nothing. */
export class StudioAlreadySetUpError extends ConflictError {
  constructor(reasons: readonly string[]) {
    super('This installation is already set up, so nothing was changed.', [
      ...reasons.map((message) => ({ message })),
    ]);
    this.name = 'StudioAlreadySetUpError';
  }
}

/** The studio week every new installation starts with; editable in Settings, Working week. */
export const STARTING_STUDIO_WEEK: WorkingWeek = {
  workingWeekdays: DEFAULT_WORKING_CALENDAR.workingWeekdays,
  dayStartTime: DEFAULT_WORKING_CALENDAR.dayStartTime,
  dayEndTime: DEFAULT_WORKING_CALENDAR.dayEndTime,
  workingMinutesPerDay: DEFAULT_WORKING_CALENDAR.workingMinutesPerDay,
};

function inputProblems(input: StudioSetupInput): { field: string; message: string }[] {
  const problems: { field: string; message: string }[] = [];
  if (input.studioName.trim().length < 2) {
    problems.push({ field: 'studioName', message: 'Give the studio a name.' });
  }
  if (input.ownerName.trim().length < 2) {
    problems.push({ field: 'ownerName', message: 'Give the owner’s full name.' });
  }
  if (!isPhoneNumberE164(input.ownerPhoneE164)) {
    problems.push({
      field: 'ownerPhone',
      message: 'Use a full mobile number, e.g. +91 98765 43210.',
    });
  }
  if (!isValidTimeZone(input.timeZone)) {
    problems.push({ field: 'timezone', message: 'Use an IANA time zone such as Asia/Kolkata.' });
  }
  if (!/^[A-Z]{3}$/.test(input.currency)) {
    problems.push({
      field: 'currency',
      message: 'Use a three-letter ISO currency code such as INR.',
    });
  }
  if (!/^[A-Z]{2,5}$/.test(input.projectReferencePrefix)) {
    problems.push({ field: 'referencePrefix', message: 'Use 2 to 5 capital letters, e.g. ARN.' });
  }
  return problems;
}

function refusals(state: StudioSetupState): string[] {
  return [
    ...(state.settingsConfigured ? ['Studio settings are already configured.'] : []),
    ...(state.ownerExists ? ['An owner account already exists.'] : []),
    ...(state.defaultCalendarExists ? ['A default working calendar already exists.'] : []),
    ...(state.ownerPhoneInUse ? ['Someone already signs in with this phone number.'] : []),
  ];
}

/**
 * First-time production setup in one transaction: studio settings, the
 * studio week, the default role access and the owner. No demo data. Refuses
 * (changing nothing) once any of it exists, so running it again is safe.
 */
export class SetUpStudioCommand {
  constructor(private readonly uow: UnitOfWork<SetupStores>) {}

  async execute(input: StudioSetupInput): Promise<StudioSetupResult> {
    const problems = inputProblems(input);
    const weekProblems = validateWorkingWeek(STARTING_STUDIO_WEEK);
    if (problems.length > 0 || weekProblems.length > 0) {
      throw new ValidationFailedError('Check the setup details.', [...problems, ...weekProblems]);
    }
    return this.uow.transaction(async (stores) => {
      await stores.setup.lock();
      const blocking = refusals(await stores.setup.state(input.ownerPhoneE164));
      if (blocking.length > 0) throw new StudioAlreadySetUpError(blocking);
      const studioName = input.studioName.trim();
      await stores.setup.createSettings({
        name: studioName,
        timeZone: input.timeZone,
        currency: input.currency,
        projectReferencePrefix: input.projectReferencePrefix,
      });
      const calendar = await stores.setup.createDefaultCalendar({
        name: 'Studio week',
        timeZone: input.timeZone,
        ...STARTING_STUDIO_WEEK,
      });
      const grantsAdded = await stores.setup.grantRoleCapabilities(
        ROLES.map((role) => ({ role, capabilities: DEFAULT_ROLE_CAPABILITIES[role] })),
      );
      const owner = await stores.setup.createOwner({
        fullName: input.ownerName.trim(),
        phoneE164: input.ownerPhoneE164,
        email: input.ownerEmail,
        workingCalendarId: calendar.id,
      });
      await stores.records.appendAudit({
        actorUserId: null,
        action: 'studio.set_up',
        entityType: 'organization',
        entityId: null,
        after: {
          studioName,
          timeZone: input.timeZone,
          currency: input.currency,
          projectReferencePrefix: input.projectReferencePrefix,
          ownerUserId: owner.id,
          grantsAdded,
        },
        requestId: null,
      });
      return {
        ownerUserId: owner.id,
        calendarId: calendar.id,
        studioWeek: STARTING_STUDIO_WEEK,
        grantsAdded,
      };
    });
  }
}
