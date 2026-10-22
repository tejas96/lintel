'use client';

import { ErrorState, PageHeader, pageEnter, TabNav } from '@lintel/design-system/web';
import type { Capability } from '@lintel/domain';
import { motion } from 'motion/react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';
import { useSession } from '@/features/session/session-provider';

/** Each section is shown to people holding its capability. */
const SECTIONS: readonly { href: string; label: string; requires: Capability }[] = [
  { href: '/settings', label: 'Studio', requires: 'organization.manage_settings' },
  { href: '/settings/roles', label: 'Roles and access', requires: 'roles.manage' },
  { href: '/settings/teams', label: 'Teams', requires: 'users.manage' },
  { href: '/settings/holidays', label: 'Holidays', requires: 'organization.manage_settings' },
  {
    href: '/settings/working-week',
    label: 'Working week',
    requires: 'organization.manage_settings',
  },
  { href: '/settings/leave', label: 'Leave', requires: 'leave.manage_policies' },
];

/** Settings pages share a header and section tabs; only administrators may enter. */
export function SettingsFrame({ children }: { readonly children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { can } = useSession();
  const sections = SECTIONS.filter((section) => can(section.requires));
  const current = SECTIONS.find((section) => section.href === pathname);
  // Someone who may only manage, say, leave lands on the first section they can open.
  const elsewhere = current && !can(current.requires) ? sections[0]?.href : undefined;
  useEffect(() => {
    if (elsewhere) router.replace(elsewhere);
  }, [elsewhere, router]);
  if (elsewhere) return null;
  if (sections.length === 0 || (current && !can(current.requires))) {
    return (
      <div className="px-5 py-10">
        <ErrorState
          kind="forbidden"
          title="Settings are for studio administrators"
          message="Ask the studio owner if something here needs to change."
        />
      </div>
    );
  }
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-7 px-5 py-6 md:px-10 md:py-9">
      <motion.div {...pageEnter}>
        <PageHeader
          title="Settings"
          description="How the studio works: its details, who can do what, when it works and how leave is handled."
        />
      </motion.div>
      <TabNav
        label="Settings sections"
        link={Link}
        items={sections.map((section) => ({
          href: section.href,
          label: section.label,
          active: pathname === section.href,
        }))}
      />
      <div>{children}</div>
    </div>
  );
}
