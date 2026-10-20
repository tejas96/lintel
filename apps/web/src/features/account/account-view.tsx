'use client';

import { Avatar, PageHeader, pageEnter } from '@lintel/design-system/web';
import { ROLE_LABELS } from '@lintel/domain';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { useSession } from '@/features/session/session-provider';
import { api, expectStatus } from '@/lib/api/api-client';
import { queryKeys } from '@/lib/query/query-keys';
import { AppearanceControls } from '@/shell/appearance-controls';
import { ActiveSessions } from './active-sessions';
import { NotificationSettings } from './notification-settings';

/** A section of the account page: what it is on the left, the controls on the right. */
function AccountSection({
  id,
  title,
  description,
  children,
}: {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="grid gap-4 border-t border-hairline pt-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10"
    >
      <div className="flex flex-col gap-1">
        <h2 id={id} className="type-title-lg text-ink">
          {title}
        </h2>
        <p className="type-body-sm text-ink-muted">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

/** The signed-in person's profile, appearance, notifications and signed-in devices. */
export function AccountView() {
  const { user } = useSession();
  const teams = useQuery({
    queryKey: queryKeys.teams,
    queryFn: () => expectStatus(api.people.listTeams(), 200),
  });
  const team = teams.data?.find((candidate) => candidate.id === user.teamId);
  const facts = [
    { label: 'Role', value: ROLE_LABELS[user.role] },
    { label: 'Team', value: user.teamId ? (team?.name ?? '…') : 'No team' },
    { label: 'Mobile', value: user.maskedPhone, mono: true },
    { label: 'Email', value: user.email ?? 'Not added' },
  ];
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-6 md:px-10 md:py-9">
      <motion.div {...pageEnter}>
        <PageHeader
          title="Your account"
          description="How Lintel looks and reaches you, and where you’re signed in."
        />
      </motion.div>
      <AccountSection
        id="profile"
        title="Profile"
        description="To change your name, number or role, ask a studio administrator."
      >
        <div className="flex flex-col gap-5 rounded-lg border border-hairline bg-raised p-5 sm:flex-row sm:items-center">
          <Avatar name={user.fullName} hue={user.avatarHue} size="lg" decorative />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="type-display-md text-ink">{user.fullName}</p>
            <p className="type-body-sm text-ink-muted">
              {user.designation ?? ROLE_LABELS[user.role]}, {user.organizationName}
            </p>
          </div>
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
      </AccountSection>
      <AccountSection
        id="appearance"
        title="Appearance"
        description="Remembered on this device. Calm motion keeps fades and skips movement."
      >
        <div className="max-w-md rounded-lg border border-hairline bg-raised p-5">
          <AppearanceControls size="md" />
        </div>
      </AccountSection>
      <AccountSection
        id="notifications"
        title="Notifications"
        description="Everything stays in your inbox. Choose what also reaches your phone."
      >
        <NotificationSettings />
      </AccountSection>
      <AccountSection
        id="devices"
        title="Signed-in devices"
        description="Lost a phone or used a shared computer? Sign that device out here."
      >
        <ActiveSessions />
      </AccountSection>
    </div>
  );
}
