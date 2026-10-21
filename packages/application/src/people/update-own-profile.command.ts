import {
  definedOnly,
  NotFoundError,
  type Patch,
  StaleVersionError,
  ValidationFailedError,
} from '@lintel/shared';
import type { RequestContext } from '../common/request-context';
import type { ApplicationStores, UnitOfWork } from '../common/unit-of-work';
import type { PersonRecord } from './people.store';

/**
 * The only fields people may change about themselves. Role, phone number,
 * status, team, manager and capacity stay with studio administrators.
 */
export interface OwnProfileFields {
  readonly fullName: string;
  readonly email: string | null;
  readonly designation: string | null;
}

const OWN_PROFILE_FIELDS: readonly (keyof OwnProfileFields)[] = [
  'fullName',
  'email',
  'designation',
];

export interface UpdateOwnProfileInput {
  readonly version: number;
  readonly changes: Patch<OwnProfileFields>;
}

type ProfileStores = Pick<ApplicationStores, 'people' | 'records'>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Copies only the self-editable fields, so nothing else can ride along at runtime. */
export function pickOwnProfileFields(changes: Patch<OwnProfileFields>): Partial<OwnProfileFields> {
  const picked: Patch<OwnProfileFields> = {};
  for (const field of OWN_PROFILE_FIELDS) {
    if (field in changes) Object.assign(picked, { [field]: changes[field] });
  }
  return definedOnly(picked);
}

function normalise(changes: Partial<OwnProfileFields>): Partial<OwnProfileFields> {
  const text = (value: string | null | undefined) =>
    value === undefined ? undefined : value === null || value.trim() === '' ? null : value.trim();
  return definedOnly<OwnProfileFields>({
    fullName: changes.fullName?.trim(),
    email: text(changes.email),
    designation: text(changes.designation),
  });
}

function validate(changes: Partial<OwnProfileFields>): void {
  const problems: { field: keyof OwnProfileFields; message: string }[] = [];
  if (
    changes.fullName !== undefined &&
    (changes.fullName.length < 2 || changes.fullName.length > 200)
  ) {
    problems.push({ field: 'fullName', message: 'Use 2 to 200 characters for your name.' });
  }
  if (changes.email && (changes.email.length > 200 || !EMAIL_PATTERN.test(changes.email))) {
    problems.push({ field: 'email', message: 'Check the email address.' });
  }
  if (changes.designation && changes.designation.length > 120) {
    problems.push({ field: 'designation', message: 'Keep the designation under 120 characters.' });
  }
  if (problems.length > 0) throw new ValidationFailedError('Check your profile.', problems);
}

function changedOnly(before: PersonRecord, changes: Partial<OwnProfileFields>) {
  return Object.fromEntries(
    Object.entries(changes).filter(
      ([field, value]) => before[field as keyof OwnProfileFields] !== value,
    ),
  ) as Partial<OwnProfileFields>;
}

/** The signed-in person edits their own name, email and designation. Audited. */
export class UpdateOwnProfileCommand {
  constructor(private readonly uow: UnitOfWork<ProfileStores>) {}

  async execute(context: RequestContext, input: UpdateOwnProfileInput): Promise<PersonRecord> {
    const requested = normalise(pickOwnProfileFields(input.changes));
    validate(requested);
    const userId = context.actor.userId;
    return this.uow.transaction(async (stores) => {
      const before = await stores.people.findById(userId);
      if (before?.status !== 'active') throw new NotFoundError('Your profile');
      if (before.version !== input.version) throw new StaleVersionError('Your profile');
      const changes = changedOnly(before, requested);
      const fields = Object.keys(changes) as (keyof OwnProfileFields)[];
      if (fields.length === 0) return before;
      const after = await stores.people.update(userId, input.version, changes);
      if (!after) throw new StaleVersionError('Your profile');
      await stores.records.appendAudit({
        actorUserId: userId,
        action: 'people.profile_updated',
        entityType: 'user',
        entityId: userId,
        before: Object.fromEntries(fields.map((field) => [field, before[field]])),
        after: { ...changes },
        requestId: context.requestId,
      });
      return after;
    });
  }
}
