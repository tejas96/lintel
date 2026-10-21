import type { StudioSetupInput } from '@lintel/application';
import { isValidTimeZone, toPhoneNumberE164 } from '@lintel/shared';
import { z } from 'zod';

/** Each option as a flag, with an environment variable as the fallback (for `docker compose run -e`). */
export const SETUP_OPTIONS = {
  studioName: { flag: '--studio-name', env: 'LINTEL_STUDIO_NAME' },
  ownerName: { flag: '--owner-name', env: 'LINTEL_OWNER_NAME' },
  ownerPhone: { flag: '--owner-phone', env: 'LINTEL_OWNER_PHONE' },
  ownerCountryCode: { flag: '--owner-country-code', env: 'LINTEL_OWNER_COUNTRY_CODE' },
  ownerEmail: { flag: '--owner-email', env: 'LINTEL_OWNER_EMAIL' },
  timezone: { flag: '--timezone', env: 'LINTEL_TIMEZONE' },
  currency: { flag: '--currency', env: 'LINTEL_CURRENCY' },
  referencePrefix: { flag: '--reference-prefix', env: 'LINTEL_REFERENCE_PREFIX' },
} as const;

type OptionName = keyof typeof SETUP_OPTIONS;

export const SETUP_USAGE = `Set up a new Lintel installation: studio settings, the studio week,
role access and the owner account. Runs once; it refuses (and changes
nothing) when the installation is already set up.

  --studio-name "Aranya Design Studio"   required
  --owner-name "Aarav Mehta"             required
  --owner-phone "+91 98765 43210"        required; the owner signs in with it
  --owner-country-code 91                default 91 (used when the number has no +)
  --owner-email owner@studio.in          optional
  --timezone Asia/Kolkata                default Asia/Kolkata
  --currency INR                         default INR
  --reference-prefix ARN                 default: the studio name's initials

Every option can also come from the environment, e.g. LINTEL_STUDIO_NAME.
DATABASE_URL must point at the migrated database.`;

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === '' ? undefined : value))
  .optional();

const rawSchema = z.object({
  studioName: z
    .string({ required_error: 'is required' })
    .trim()
    .min(2, 'needs at least 2 characters')
    .max(200),
  ownerName: z
    .string({ required_error: 'is required' })
    .trim()
    .min(2, 'needs at least 2 characters')
    .max(200),
  ownerPhone: z.string({ required_error: 'is required' }).trim().min(6, 'is too short').max(24),
  ownerCountryCode: z
    .string()
    .trim()
    .regex(/^\+?\d{1,4}$/, 'must be digits such as 91')
    .default('91'),
  ownerEmail: optionalText.pipe(z.string().email('is not an email address').max(200).optional()),
  timezone: z
    .string()
    .trim()
    .default('Asia/Kolkata')
    .refine(isValidTimeZone, 'must be an IANA time zone such as Asia/Kolkata'),
  currency: z
    .string()
    .trim()
    .default('INR')
    .transform((value) => value.toUpperCase())
    .pipe(z.string().regex(/^[A-Z]{3}$/, 'must be a three-letter ISO code such as INR')),
  referencePrefix: optionalText.pipe(
    z
      .string()
      .regex(/^[A-Za-z]{2,5}$/, 'must be 2 to 5 letters such as ARN')
      .transform((value) => value.toUpperCase())
      .optional(),
  ),
});

export class SetupArgumentsError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(problems.join('\n'));
    this.name = 'SetupArgumentsError';
  }
}

/** Reads `--flag value` and `--flag=value`; a leading `--` (from `pnpm run … --`) is ignored. */
function readFlags(argv: readonly string[]): Map<string, string> {
  const flags = new Map<string, string>();
  const known = new Set<string>(Object.values(SETUP_OPTIONS).map((option) => option.flag));
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] ?? '';
    if (token === '--') continue;
    const [flag = '', inline] = token.split(/=(.*)/s, 2);
    if (!known.has(flag)) throw new SetupArgumentsError([`Unknown option ${flag || token}.`]);
    const value = inline ?? argv[index + 1];
    if (value === undefined || (inline === undefined && value.startsWith('--'))) {
      throw new SetupArgumentsError([`${flag} needs a value.`]);
    }
    if (inline === undefined) index += 1;
    flags.set(flag, value);
  }
  return flags;
}

/** "Aranya Design Studio" → "ADS"; "Lintel" → "LIN". */
export function referencePrefixFor(studioName: string): string {
  const words = studioName.toUpperCase().match(/[A-Z]+/g) ?? [];
  const initials = words
    .map((word) => word[0])
    .join('')
    .slice(0, 5);
  if (initials.length >= 2) return initials;
  const first = words[0] ?? '';
  return first.length >= 2 ? first.slice(0, 3) : 'PRJ';
}

/** The owner's number exactly as the app normalises it at sign-in. */
function ownerPhoneOf(phone: string, countryCode: string): string {
  const code = countryCode.replace(/\D/g, '');
  const international = phone.trim().startsWith('+');
  if (international && !phone.replace(/[\s()-]/g, '').startsWith(`+${code}`)) {
    throw new SetupArgumentsError([
      `--owner-phone starts with a different country code than ${code}. Pass --owner-country-code too.`,
    ]);
  }
  const normalised = toPhoneNumberE164(code, phone);
  if (!normalised) throw new SetupArgumentsError(['--owner-phone is not a valid mobile number.']);
  return normalised;
}

/** Flags first, then environment variables; every problem is reported at once. */
export function parseSetupArguments(
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
): StudioSetupInput {
  const flags = readFlags(argv);
  const raw = Object.fromEntries(
    (Object.keys(SETUP_OPTIONS) as OptionName[]).map((name) => {
      const option = SETUP_OPTIONS[name];
      return [name, flags.get(option.flag) ?? env[option.env]];
    }),
  );
  const parsed = rawSchema.safeParse(raw);
  if (!parsed.success) {
    throw new SetupArgumentsError(
      parsed.error.issues.map((issue) => {
        const name = issue.path[0] as OptionName;
        return `${SETUP_OPTIONS[name]?.flag ?? String(name)} ${issue.message}.`;
      }),
    );
  }
  const options = parsed.data;
  return {
    studioName: options.studioName,
    ownerName: options.ownerName,
    ownerPhoneE164: ownerPhoneOf(options.ownerPhone, options.ownerCountryCode),
    ownerEmail: options.ownerEmail ?? null,
    timeZone: options.timezone,
    currency: options.currency,
    projectReferencePrefix: options.referencePrefix ?? referencePrefixFor(options.studioName),
  };
}
