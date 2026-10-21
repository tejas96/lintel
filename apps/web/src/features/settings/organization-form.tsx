'use client';

import {
  Button,
  ErrorState,
  Field,
  Input,
  SkeletonGroup,
  SkeletonText,
  Switch,
  useToast,
} from '@lintel/design-system/web';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useEffect, useState } from 'react';
import { api, expectStatus } from '@/lib/api/api-client';
import { isApiError } from '@/lib/api/api-error';
import { describeError } from '@/lib/api/describe-error';
import { queryKeys } from '@/lib/query/query-keys';
import { useFailureToast } from '@/lib/query/use-failure-toast';

type Organization = Awaited<ReturnType<typeof loadOrganization>>;

function loadOrganization() {
  return expectStatus(api.platform.getOrganization(), 200);
}

/** Studio name, project reference prefix, reminder time and quiet hours. */
export function OrganizationForm() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const fail = useFailureToast();
  const organization = useQuery({ queryKey: queryKeys.organization, queryFn: loadOrganization });
  const [draft, setDraft] = useState<Organization | null>(null);
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  useEffect(() => {
    if (organization.data) setDraft(organization.data);
  }, [organization.data]);
  const save = useMutation({
    mutationFn: (body: Omit<Organization, 'leaveSecondApprovalAboveHalfDays'>) =>
      expectStatus(api.platform.updateOrganization({ body }), 200),
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKeys.organization, saved);
      setErrors({});
      toast({ tone: 'success', title: 'Studio settings saved' });
    },
    onError: (error) => {
      if (isApiError(error)) setErrors(error.fieldErrors());
      fail(error, 'save the settings', [queryKeys.organization]);
    },
  });

  if (organization.isPending || !draft) {
    if (organization.isError)
      return (
        <ErrorState
          {...describeError(organization.error, { resource: 'item', noun: 'settings page' })}
          onRetry={() => organization.refetch()}
        />
      );
    return (
      <SkeletonGroup label="Loading studio settings">
        <SkeletonText lines={6} />
      </SkeletonGroup>
    );
  }
  const update = (patch: Partial<Organization>) => setDraft({ ...draft, ...patch });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    // The leave approval threshold is edited under Settings, Leave; leaving it out keeps it.
    const { leaveSecondApprovalAboveHalfDays: _threshold, ...studio } = draft;
    save.mutate({ ...studio, projectReferencePrefix: draft.projectReferencePrefix.toUpperCase() });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-8">
      <section className="grid gap-5 sm:grid-cols-2">
        <Field label="Studio name" error={errors.name} required className="sm:col-span-2">
          <Input
            value={draft.name}
            onChange={(event) => update({ name: event.target.value })}
            maxLength={200}
          />
        </Field>
        <Field
          label="Project reference prefix"
          hint="2 to 5 capital letters, e.g. ARN gives ARN-2026-001."
          error={errors.projectReferencePrefix}
        >
          <Input
            value={draft.projectReferencePrefix}
            onChange={(event) =>
              update({
                projectReferencePrefix: event.target.value
                  .toUpperCase()
                  .replace(/[^A-Z]/g, '')
                  .slice(0, 5),
              })
            }
            className="font-mono uppercase"
          />
        </Field>
        <Field label="Time zone" hint="Dates and deadlines follow this time zone.">
          <Input value={draft.timeZone} readOnly className="text-ink-muted" />
        </Field>
      </section>
      <section className="grid gap-5 sm:grid-cols-3">
        <Field label="Daily deadline reminder" error={errors.deadlineReminderTime}>
          <Input
            type="time"
            value={draft.deadlineReminderTime}
            onChange={(event) => update({ deadlineReminderTime: event.target.value })}
          />
        </Field>
        <Field
          label="Quiet hours start"
          hint="No notifications are pushed during quiet hours."
          error={errors.defaultQuietHoursStart}
        >
          <Input
            type="time"
            value={draft.defaultQuietHoursStart}
            onChange={(event) => update({ defaultQuietHoursStart: event.target.value })}
          />
        </Field>
        <Field label="Quiet hours end" error={errors.defaultQuietHoursEnd}>
          <Input
            type="time"
            value={draft.defaultQuietHoursEnd}
            onChange={(event) => update({ defaultQuietHoursEnd: event.target.value })}
          />
        </Field>
      </section>
      <section className="grid gap-5 sm:grid-cols-2">
        <Switch
          label="Track working time"
          description="People start and pause work sessions on their tasks. Switching it off ends running sessions and keeps their time."
          checked={draft.workTrackingEnabled}
          onCheckedChange={(workTrackingEnabled) => update({ workTrackingEnabled })}
        />
        <Switch
          label="Profitability"
          description="Record project costs and compare them with each budget. Only people who can see budgets — the owner, administrators and each project’s manager — see the numbers."
          checked={draft.profitabilityEnabled}
          onCheckedChange={(profitabilityEnabled) => update({ profitabilityEnabled })}
          className="sm:col-start-2"
        />
      </section>
      <div className="flex gap-2 border-t border-hairline pt-6">
        <Button type="submit" variant="primary" pending={save.isPending}>
          Save changes
        </Button>
        <Button
          variant="quiet"
          onClick={() => setDraft(organization.data ?? null)}
          disabled={save.isPending}
        >
          Discard changes
        </Button>
      </div>
    </form>
  );
}
