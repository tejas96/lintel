'use client';

import { PageHeader, pageEnter } from '@lintel/design-system/web';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { AppearanceControls } from '@/shell/appearance-controls';
import { ActiveSessions } from './active-sessions';
import { NotificationSettings } from './notification-settings';
import { ProfileCard } from './profile-card';

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
        description="Keep your name, email and designation current. Your role, team and number are set by the studio."
      >
        <ProfileCard />
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
        description="Everything stays in your inbox. Choose what also reaches your phone, this browser or your email."
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
