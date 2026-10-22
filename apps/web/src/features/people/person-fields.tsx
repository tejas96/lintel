'use client';

import type { DirectoryEntry, Team } from '@lintel/api-contracts';
import { Field, Input, Select } from '@lintel/design-system/web';
import { ROLE_LABELS, ROLES, type Role } from '@lintel/domain';
import { PersonCombobox } from './person-combobox';
import { STUDIO_WEEK, WorkingWeekSelect } from './working-week-select';

export interface PersonFormValues {
  readonly fullName: string;
  readonly phone: string;
  readonly email: string;
  readonly designation: string;
  readonly role: Role;
  readonly teamId: string;
  readonly reportsTo: string | null;
  readonly capacityPercent: string;
  /** A working calendar id, or STUDIO_WEEK. */
  readonly workingCalendarId: string;
}

export const NO_TEAM = 'none';

export function emptyPerson(): PersonFormValues {
  return {
    fullName: '',
    phone: '',
    email: '',
    designation: '',
    role: 'employee',
    teamId: NO_TEAM,
    reportsTo: null,
    capacityPercent: '100',
    workingCalendarId: STUDIO_WEEK,
  };
}

export function valuesOf(person: DirectoryEntry): PersonFormValues {
  return {
    fullName: person.fullName,
    phone: '',
    email: person.email ?? '',
    designation: person.designation ?? '',
    role: person.role,
    teamId: person.team?.id ?? NO_TEAM,
    reportsTo: person.reportsTo?.id ?? null,
    capacityPercent: String(person.capacityPercent),
    workingCalendarId: person.workingCalendarId ?? STUDIO_WEEK,
  };
}

/** Checks the form before sending (the server checks again); keys match the API's fields. */
export function checkPerson(values: PersonFormValues, phoneRequired: boolean) {
  const errors: Record<string, string> = {};
  if (!values.fullName.trim()) errors.fullName = 'Enter their name.';
  const digits = values.phone.replace(/\D/g, '');
  if ((phoneRequired || digits.length > 0) && digits.length < 6) {
    errors.nationalNumber = 'Enter their mobile number.';
  }
  if (values.email.trim() && !/^\S+@\S+\.\S+$/.test(values.email.trim())) {
    errors.email = 'Check the email address.';
  }
  const capacity = Number(values.capacityPercent);
  if (!Number.isInteger(capacity) || capacity < 10 || capacity > 100) {
    errors.capacityPercent = 'Use a whole number from 10 to 100.';
  }
  return errors;
}

interface PersonFieldsProps {
  readonly values: PersonFormValues;
  readonly onChange: (values: PersonFormValues) => void;
  readonly errors: Readonly<Record<string, string>>;
  readonly teams: readonly Team[];
  /** The person's team today; still offered if it has since been archived. */
  readonly currentTeam?: { readonly id: string; readonly name: string } | null;
  /** Adding asks for the phone; editing offers to replace it. */
  readonly mode: 'add' | 'edit';
  /** The person being edited (cannot report to themselves). */
  readonly personId?: string;
  /** The owner's role cannot be changed here. */
  readonly isOwner?: boolean;
}

/** Who someone is in the studio: contact, role, team, manager and how much of a week they work. */
export function PersonFields({
  values,
  onChange,
  errors,
  teams,
  currentTeam = null,
  mode,
  personId,
  isOwner = false,
}: PersonFieldsProps) {
  const set = <K extends keyof PersonFormValues>(key: K, value: PersonFormValues[K]) =>
    onChange({ ...values, [key]: value });
  const archivedTeam =
    currentTeam && !teams.some((team) => team.id === currentTeam.id) ? currentTeam : null;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Full name" error={errors.fullName} required>
        <Input
          value={values.fullName}
          onChange={(event) => set('fullName', event.target.value)}
          maxLength={200}
        />
      </Field>
      <Field
        label={mode === 'add' ? 'Mobile number (+91)' : 'New mobile number (+91)'}
        hint={
          mode === 'add' ? 'They sign in with this number.' : 'Leave empty to keep the current one.'
        }
        error={errors.nationalNumber}
        required={mode === 'add'}
      >
        <Input
          type="tel"
          inputMode="tel"
          value={values.phone}
          onChange={(event) => set('phone', event.target.value)}
          maxLength={20}
        />
      </Field>
      <Field label="Email" hint="Optional." error={errors.email}>
        <Input
          type="email"
          value={values.email}
          onChange={(event) => set('email', event.target.value)}
          maxLength={200}
        />
      </Field>
      <Field label="Designation" hint="For example: Interior designer" error={errors.designation}>
        <Input
          value={values.designation}
          onChange={(event) => set('designation', event.target.value)}
          maxLength={120}
        />
      </Field>
      <Field
        label="Role"
        hint={isOwner ? 'The owner keeps every permission.' : 'Decides what they can see and do.'}
        error={errors.role}
      >
        <Select
          value={values.role}
          disabled={isOwner}
          onValueChange={(role) => set('role', role)}
          options={(isOwner ? ROLES : ROLES.filter((role) => role !== 'owner')).map((role) => ({
            value: role,
            label: ROLE_LABELS[role],
          }))}
        />
      </Field>
      <Field
        label="Team"
        error={errors.teamId}
        {...(teams.length === 0 ? { hint: 'No teams yet. Add them in Settings, Teams.' } : {})}
      >
        <Select
          value={values.teamId}
          onValueChange={(teamId) => set('teamId', teamId)}
          options={[
            { value: NO_TEAM, label: 'No team' },
            ...teams.map((team) => ({ value: team.id, label: team.name })),
            ...(archivedTeam
              ? [{ value: archivedTeam.id, label: `${archivedTeam.name} (archived)` }]
              : []),
          ]}
        />
      </Field>
      <Field
        label="Reports to"
        hint="Their manager approves their leave first."
        error={errors.reportsToUserId}
      >
        <PersonCombobox
          value={values.reportsTo}
          onValueChange={(reportsTo) => set('reportsTo', reportsTo)}
          excludeIds={personId ? [personId] : []}
          clearable
        />
      </Field>
      <Field
        label="Works (% of a full week)"
        hint="80 for four days a week. Capacity uses this."
        error={errors.capacityPercent}
      >
        <Input
          inputMode="numeric"
          value={values.capacityPercent}
          onChange={(event) => set('capacityPercent', event.target.value)}
          trailing={<span className="pr-1">%</span>}
        />
      </Field>
      <WorkingWeekSelect
        value={values.workingCalendarId}
        onValueChange={(workingCalendarId) => set('workingCalendarId', workingCalendarId)}
        error={errors.workingCalendarId}
      />
    </div>
  );
}
