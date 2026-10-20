import type { Role } from '@lintel/domain';

/**
 * Obviously fictional studio people for local development. Phone numbers use
 * the +91 90000 0xxxx range and only ever receive codes from the local OTP
 * provider; the seed refuses to run in production.
 */
export interface SeedPerson {
  readonly key: string;
  readonly fullName: string;
  readonly phoneE164: string;
  readonly role: Role;
  readonly designation: string;
  readonly team: 'Design' | 'Site' | 'Leadership';
  readonly reportsTo: string | null;
  readonly avatarHue: number;
}

export const SEED_PEOPLE: readonly SeedPerson[] = [
  {
    key: 'owner',
    fullName: 'Aarav Mehta',
    phoneE164: '+919000000001',
    role: 'owner',
    designation: 'Principal designer',
    team: 'Leadership',
    reportsTo: null,
    avatarHue: 222,
  },
  {
    key: 'admin',
    fullName: 'Kabir Sen',
    phoneE164: '+919000000002',
    role: 'administrator',
    designation: 'Studio operations',
    team: 'Leadership',
    reportsTo: 'owner',
    avatarHue: 32,
  },
  {
    key: 'pm1',
    fullName: 'Nisha Varma',
    phoneE164: '+919000000003',
    role: 'project_manager',
    designation: 'Senior project manager',
    team: 'Design',
    reportsTo: 'owner',
    avatarHue: 150,
  },
  {
    key: 'pm2',
    fullName: 'Rohan Iyer',
    phoneE164: '+919000000004',
    role: 'project_manager',
    designation: 'Project architect',
    team: 'Design',
    reportsTo: 'owner',
    avatarHue: 280,
  },
  {
    key: 'lead',
    fullName: 'Tara Kulkarni',
    phoneE164: '+919000000005',
    role: 'team_lead',
    designation: 'Design lead',
    team: 'Design',
    reportsTo: 'pm1',
    avatarHue: 340,
  },
  {
    key: 'designer1',
    fullName: 'Ananya Joshi',
    phoneE164: '+919000000006',
    role: 'employee',
    designation: 'Interior designer',
    team: 'Design',
    reportsTo: 'lead',
    avatarHue: 12,
  },
  {
    key: 'designer2',
    fullName: 'Dev Patel',
    phoneE164: '+919000000007',
    role: 'employee',
    designation: 'Interior designer',
    team: 'Design',
    reportsTo: 'lead',
    avatarHue: 190,
  },
  {
    key: 'designer3',
    fullName: 'Leela Nair',
    phoneE164: '+919000000008',
    role: 'employee',
    designation: '3D visualiser',
    team: 'Design',
    reportsTo: 'lead',
    avatarHue: 95,
  },
  {
    key: 'architect',
    fullName: 'Farhan Qureshi',
    phoneE164: '+919000000009',
    role: 'employee',
    designation: 'Architect',
    team: 'Design',
    reportsTo: 'pm2',
    avatarHue: 250,
  },
  {
    key: 'site',
    fullName: 'Vikram Singh',
    phoneE164: '+919000000010',
    role: 'site_supervisor',
    designation: 'Site supervisor',
    team: 'Site',
    reportsTo: 'pm1',
    avatarHue: 55,
  },
];

/** Fixed-date public holidays only. Studios must review and extend this list. */
export const SEED_HOLIDAYS: readonly { date: string; name: string }[] = [
  { date: '2026-01-26', name: 'Republic Day' },
  { date: '2026-08-15', name: 'Independence Day' },
  { date: '2026-10-02', name: 'Gandhi Jayanti' },
  { date: '2026-12-25', name: 'Christmas' },
  { date: '2027-01-26', name: 'Republic Day' },
];

/** Example leave types. Allowances are placeholders, not statutory entitlements. */
export const SEED_LEAVE_TYPES = [
  {
    code: 'casual',
    name: 'Casual leave',
    requiresReason: false,
    allowsHalfDay: true,
    minimumNoticeDays: 2,
    annualAllowanceHalfDays: 24,
    colorIndex: 0,
  },
  {
    code: 'sick',
    name: 'Sick leave',
    requiresReason: false,
    allowsHalfDay: true,
    minimumNoticeDays: 0,
    annualAllowanceHalfDays: 24,
    colorIndex: 1,
  },
  {
    code: 'earned',
    name: 'Earned leave',
    requiresReason: true,
    allowsHalfDay: false,
    minimumNoticeDays: 7,
    annualAllowanceHalfDays: 30,
    colorIndex: 2,
  },
  {
    code: 'unpaid',
    name: 'Unpaid leave',
    requiresReason: true,
    allowsHalfDay: true,
    minimumNoticeDays: 3,
    annualAllowanceHalfDays: null,
    colorIndex: 3,
  },
] as const;
