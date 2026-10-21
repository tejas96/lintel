'use client';

import { Avatar, Button } from '@lintel/design-system/web';
import { ROLE_LABELS } from '@lintel/domain';
import { useQuery } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { useSession } from '@/features/session/session-provider';
import { api, expectStatus } from '@/lib/api/api-client';
import { EditProfileSheet, ownProfileKey } from './edit-profile-sheet';

/** Who you are in the studio, with a way to keep your name, email and designation current. */
export function ProfileCard() {
  const { user } = useSession();
  const [editing, setEditing] = useState(false);
  const profile = useQuery({
    queryKey: ownProfileKey,
    queryFn: () => expectStatus(api.profile.getMyProfile(), 200),
  });
  const teamName = profile.data?.team?.name ?? (user.teamId ? '…' : 'No team');
  const shown = profile.data ?? user;
  const facts = [
    { label: 'Role', value: ROLE_LABELS[shown.role] },
    { label: 'Team', value: teamName },
    { label: 'Mobile', value: shown.maskedPhone, mono: true },
    { label: 'Email', value: shown.email ?? 'Not added' },
  ];
  return (
    <>
      <div className="flex flex-col gap-5 rounded-lg border border-hairline bg-raised p-5 sm:flex-row sm:items-center">
        <Avatar name={shown.fullName} hue={shown.avatarHue} size="lg" decorative />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="type-display-md text-ink">{shown.fullName}</p>
          <p className="type-body-sm text-ink-muted">
            {shown.designation ?? ROLE_LABELS[shown.role]}, {user.organizationName}
          </p>
        </div>
        <Button
          variant="secondary"
          leadingIcon={<Pencil aria-hidden />}
          onClick={() => setEditing(true)}
          disabled={!profile.data}
          pending={profile.isPending}
          className="self-start sm:self-center"
        >
          Edit profile
        </Button>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 px-1 sm:grid-cols-4">
        {facts.map((fact) => (
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
      {profile.data && (
        <EditProfileSheet
          profile={profile.data}
          teamName={teamName}
          open={editing}
          onOpenChange={setEditing}
        />
      )}
    </>
  );
}
