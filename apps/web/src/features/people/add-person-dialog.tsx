'use client';

import type { Team } from '@lintel/api-contracts';
import { Button, Dialog, useToast } from '@lintel/design-system/web';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { api, expectStatus } from '@/lib/api/api-client';
import { isApiError } from '@/lib/api/api-error';
import { queryKeys } from '@/lib/query/query-keys';
import { useFailureToast } from '@/lib/query/use-failure-toast';
import {
  checkPerson,
  emptyPerson,
  NO_TEAM,
  PersonFields,
  type PersonFormValues,
} from './person-fields';

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
  const [values, setValues] = useState<PersonFormValues>(emptyPerson);
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});

  const create = useMutation({
    mutationFn: () =>
      expectStatus(
        api.people.createPerson({
          body: {
            fullName: values.fullName.trim(),
            countryCallingCode: '+91',
            nationalNumber: values.phone.replace(/\D/g, ''),
            email: values.email.trim() || null,
            designation: values.designation.trim() || null,
            role: values.role,
            teamId: values.teamId === NO_TEAM ? null : values.teamId,
            reportsToUserId: values.reportsTo,
            capacityPercent: Number(values.capacityPercent),
          },
        }),
        201,
      ),
    onSuccess: (person) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.allPeople });
      void queryClient.invalidateQueries({ queryKey: queryKeys.teams });
      toast({
        tone: 'success',
        title: 'Person added',
        description: `${person.fullName} can now sign in with their phone.`,
      });
      setValues(emptyPerson());
      onOpenChange(false);
    },
    onError: (error) => {
      if (isApiError(error)) setErrors(error.fieldErrors());
      fail(error, 'add the person');
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found = checkPerson(values, true);
    setErrors(found);
    if (Object.keys(found).length === 0) create.mutate();
  };

  return (
    <Dialog
      autoFocusField
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
      <form id="add-person" onSubmit={submit} className="py-2">
        <PersonFields
          values={values}
          onChange={setValues}
          errors={errors}
          teams={teams}
          mode="add"
        />
      </form>
    </Dialog>
  );
}
