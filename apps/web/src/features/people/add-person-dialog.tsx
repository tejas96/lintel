'use client';

import type { Team } from '@lintel/api-contracts';
import { Button, Dialog, Field, Input, Select, useToast } from '@lintel/design-system/web';
import { ROLE_LABELS, ROLES, type Role } from '@lintel/domain';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { api, expectStatus } from '@/lib/api/api-client';
import { isApiError } from '@/lib/api/api-error';
import { queryKeys } from '@/lib/query/query-keys';
import { useFailureToast } from '@/lib/query/use-failure-toast';
import { PersonCombobox } from './person-combobox';

interface AddPersonDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly teams: readonly Team[];
}

/** Adds someone to the studio. They can sign in with their phone at once. */
export function AddPersonDialog({ open, onOpenChange, teams }: AddPersonDialogProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const fail = useFailureToast();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [designation, setDesignation] = useState('');
  const [role, setRole] = useState<Role>('employee');
  const [teamId, setTeamId] = useState('none');
  const [reportsTo, setReportsTo] = useState<string | null>(null);
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});

  const create = useMutation({
    mutationFn: () =>
      expectStatus(
        api.people.createPerson({
          body: {
            fullName: fullName.trim(),
            countryCallingCode: '+91',
            nationalNumber: phone.replace(/\D/g, ''),
            email: null,
            designation: designation.trim() || null,
            role,
            teamId: teamId === 'none' ? null : teamId,
            reportsToUserId: reportsTo,
            capacityPercent: 100,
          },
        }),
        201,
      ),
    onSuccess: (person) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.allPeople });
      toast({
        tone: 'success',
        title: 'Person added',
        description: `${person.fullName} can now sign in with their phone.`,
      });
      setFullName('');
      setPhone('');
      setDesignation('');
      onOpenChange(false);
    },
    onError: (error) => {
      if (isApiError(error)) setErrors(error.fieldErrors());
      fail(error, 'add the person');
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (!fullName.trim()) found.fullName = 'Enter their name.';
    if (phone.replace(/\D/g, '').length < 6) found.nationalNumber = 'Enter their mobile number.';
    setErrors(found);
    if (Object.keys(found).length === 0) create.mutate();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add a person"
      description="They sign in with this phone number; no password is needed."
      size="lg"
      footer={
        <>
          <Button variant="quiet" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="add-person" pending={create.isPending}>
            Add person
          </Button>
        </>
      }
    >
      <form id="add-person" onSubmit={submit} className="grid gap-4 py-2 sm:grid-cols-2">
        <Field label="Full name" error={errors.fullName} required>
          <Input
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            maxLength={200}
          />
        </Field>
        <Field label="Mobile number (+91)" error={errors.nationalNumber} required>
          <Input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            maxLength={20}
          />
        </Field>
        <Field label="Designation" hint="For example: Interior designer">
          <Input
            value={designation}
            onChange={(event) => setDesignation(event.target.value)}
            maxLength={120}
          />
        </Field>
        <Field label="Role" hint="Decides what they can see and do.">
          <Select
            value={role}
            onValueChange={setRole}
            options={ROLES.filter((value) => value !== 'owner').map((value) => ({
              value,
              label: ROLE_LABELS[value],
            }))}
          />
        </Field>
        <Field label="Team">
          <Select
            value={teamId}
            onValueChange={setTeamId}
            options={[
              { value: 'none', label: 'No team' },
              ...teams.map((team) => ({ value: team.id, label: team.name })),
            ]}
          />
        </Field>
        <Field label="Reports to">
          <PersonCombobox value={reportsTo} onValueChange={setReportsTo} clearable />
        </Field>
      </form>
    </Dialog>
  );
}
