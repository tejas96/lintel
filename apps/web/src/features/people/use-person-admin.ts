'use client';

import type { DirectoryEntry } from '@lintel/api-contracts';
import { useToast } from '@lintel/design-system/web';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, expectStatus } from '@/lib/api/api-client';
import { queryKeys } from '@/lib/query/query-keys';
import { NO_TEAM, type PersonFormValues } from './person-fields';

/** Only the fields that changed, so a save never overwrites someone else's edit by accident. */
function changesOf(person: DirectoryEntry, values: PersonFormValues) {
  const phone = values.phone.replace(/\D/g, '');
  const teamId = values.teamId === NO_TEAM ? null : values.teamId;
  const email = values.email.trim() || null;
  const designation = values.designation.trim() || null;
  const capacityPercent = Number(values.capacityPercent);
  return {
    ...(values.fullName.trim() !== person.fullName ? { fullName: values.fullName.trim() } : {}),
    ...(phone ? { countryCallingCode: '+91', nationalNumber: phone } : {}),
    ...(email !== person.email ? { email } : {}),
    ...(designation !== person.designation ? { designation } : {}),
    ...(values.role !== person.role ? { role: values.role } : {}),
    ...(teamId !== (person.team?.id ?? null) ? { teamId } : {}),
    ...(values.reportsTo !== (person.reportsTo?.id ?? null)
      ? { reportsToUserId: values.reportsTo }
      : {}),
    ...(capacityPercent !== person.capacityPercent ? { capacityPercent } : {}),
  };
}

/** Saving a person, deactivating and reactivating. Each refreshes the directory. */
export function usePersonAdmin(person: DirectoryEntry) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.allPeople });
    void queryClient.invalidateQueries({ queryKey: queryKeys.teams });
  };
  const save = useMutation({
    mutationFn: (values: PersonFormValues) =>
      expectStatus(
        api.people.updatePerson({
          params: { id: person.id },
          body: { ...changesOf(person, values), version: person.version },
        }),
        200,
      ),
    onSuccess: (updated) => {
      refresh();
      toast({ tone: 'success', title: 'Changes saved', description: updated.fullName });
    },
  });
  const deactivate = useMutation({
    mutationFn: (reason: string) =>
      expectStatus(
        api.people.deactivatePerson({
          params: { id: person.id },
          body: { reason, version: person.version },
        }),
        200,
      ),
    onSuccess: (updated) => {
      refresh();
      toast({
        tone: 'success',
        title: 'Account deactivated',
        description: `${updated.fullName} has been signed out everywhere.`,
      });
    },
  });
  const reactivate = useMutation({
    mutationFn: () =>
      expectStatus(
        api.people.reactivatePerson({
          params: { id: person.id },
          body: { version: person.version },
        }),
        200,
      ),
    onSuccess: (updated) => {
      refresh();
      toast({
        tone: 'success',
        title: 'Account reactivated',
        description: `${updated.fullName} can sign in again.`,
      });
    },
  });
  return {
    save,
    deactivate,
    reactivate,
    hasChanges: (values: PersonFormValues) => Object.keys(changesOf(person, values)).length > 0,
  };
}
