'use client';

import type { OwnProfile } from '@lintel/api-contracts';
import { Button, Field, Input, Sheet, useToast } from '@lintel/design-system/web';
import { ROLE_LABELS } from '@lintel/domain';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Lock } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { StaleVersionNotice, useStaleVersion } from '@/features/common/stale-version-notice';
import { sessionQueryKey, useSession } from '@/features/session/session-provider';
import { api, expectStatus } from '@/lib/api/api-client';
import { isApiError } from '@/lib/api/api-error';
import { useFailureToast } from '@/lib/query/use-failure-toast';

export const ownProfileKey = ['account', 'profile'] as const;

interface ProfileValues {
  readonly fullName: string;
  readonly email: string;
  readonly designation: string;
}

const orNull = (text: string) => (text.trim() === '' ? null : text.trim());

function changesOf(profile: OwnProfile, values: ProfileValues) {
  return {
    ...(values.fullName.trim() !== profile.fullName ? { fullName: values.fullName.trim() } : {}),
    ...(orNull(values.email) !== profile.email ? { email: orNull(values.email) } : {}),
    ...(orNull(values.designation) !== profile.designation
      ? { designation: orNull(values.designation) }
      : {}),
  };
}

function check(values: ProfileValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (values.fullName.trim().length < 2) errors.fullName = 'Enter your name.';
  if (values.email.trim() && !/^\S+@\S+\.\S+$/.test(values.email.trim())) {
    errors.email = 'Check the email address.';
  }
  return errors;
}

interface EditProfileSheetProps {
  readonly profile: OwnProfile;
  readonly teamName: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

/** Name, email and designation are yours; role, team and number stay with the studio. */
export function EditProfileSheet({ profile, teamName, open, onOpenChange }: EditProfileSheetProps) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      autoFocusField
      title="Edit your profile"
      description="How colleagues see you in Lintel."
    >
      <ProfileForm
        key={profile.version}
        profile={profile}
        teamName={teamName}
        onDone={() => onOpenChange(false)}
      />
    </Sheet>
  );
}

function ProfileForm({
  profile,
  teamName,
  onDone,
}: {
  readonly profile: OwnProfile;
  readonly teamName: string;
  readonly onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const fail = useFailureToast();
  const staleness = useStaleVersion();
  const { can } = useSession();
  const [values, setValues] = useState<ProfileValues>({
    fullName: profile.fullName,
    email: profile.email ?? '',
    designation: profile.designation ?? '',
  });
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const changes = changesOf(profile, values);
  const save = useMutation({
    mutationFn: () =>
      expectStatus(
        api.profile.updateMyProfile({ body: { ...changes, version: profile.version } }),
        200,
      ),
    onSuccess: (saved) => {
      queryClient.setQueryData(ownProfileKey, saved);
      void queryClient.invalidateQueries({ queryKey: sessionQueryKey });
      toast({ tone: 'success', title: 'Profile saved' });
      onDone();
    },
    onError: (error) => {
      if (staleness.catchStale(error)) return;
      if (isApiError(error)) setErrors(error.fieldErrors());
      fail(error, 'save your profile');
    },
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found = check(values);
    setErrors(found);
    if (Object.keys(found).length === 0 && Object.keys(changes).length > 0) save.mutate();
  };
  const set = (key: keyof ProfileValues) => (event: { target: { value: string } }) =>
    setValues({ ...values, [key]: event.target.value });
  const managed = [
    { label: 'Role', value: ROLE_LABELS[profile.role] },
    { label: 'Team', value: teamName },
    { label: 'Mobile', value: profile.maskedPhone, mono: true },
  ];

  return (
    <form onSubmit={submit} className="flex flex-col gap-7 p-5 sm:p-6" noValidate>
      <StaleVersionNotice
        show={staleness.stale}
        message="Your profile changed somewhere else (perhaps on your phone). Refresh to load it, then make your change again."
        onRefresh={() => {
          staleness.clear();
          void queryClient.invalidateQueries({ queryKey: ownProfileKey });
        }}
      />
      <div className="flex flex-col gap-4">
        <Field label="Full name" error={errors.fullName} required>
          <Input value={values.fullName} onChange={set('fullName')} maxLength={200} />
        </Field>
        <Field
          label="Email"
          hint="Optional. Colleagues see it in the directory."
          error={errors.email}
        >
          <Input type="email" value={values.email} onChange={set('email')} maxLength={200} />
        </Field>
        <Field label="Designation" hint="For example: Interior designer" error={errors.designation}>
          <Input value={values.designation} onChange={set('designation')} maxLength={120} />
        </Field>
      </div>
      <section
        aria-labelledby="managed-by-studio"
        className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-4"
      >
        <h3 id="managed-by-studio" className="flex items-center gap-2 type-label text-ink-muted">
          <Lock aria-hidden className="size-3.5 text-ink-faint" />
          Set by your studio
        </h3>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {managed.map((fact) => (
            <div key={fact.label} className="flex min-w-0 flex-col gap-0.5">
              <dt className="type-label text-ink-faint">{fact.label}</dt>
              <dd
                className={
                  fact.mono
                    ? 'truncate font-mono text-[0.8125rem] text-ink'
                    : 'truncate type-body-sm text-ink'
                }
              >
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
        <p className="type-body-sm text-ink-faint">
          {can('users.manage')
            ? 'You change these under People, as for anyone else. A new number signs you out everywhere.'
            : 'To change these, ask a studio administrator. A new number signs you out everywhere.'}
        </p>
      </section>
      <div className="flex justify-end gap-2 border-t border-hairline pt-5">
        <Button variant="quiet" onClick={onDone} disabled={save.isPending}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          pending={save.isPending}
          disabled={Object.keys(changes).length === 0 || staleness.stale}
        >
          Save profile
        </Button>
      </div>
    </form>
  );
}
