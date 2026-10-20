'use client';

import { ErrorState, PageHeader, pageEnter, TabNav } from '@lintel/design-system/web';
import { motion } from 'motion/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useSession } from '@/features/session/session-provider';

const SECTIONS = [
  { href: '/settings', label: 'Studio' },
  { href: '/settings/roles', label: 'Roles and access' },
  { href: '/settings/holidays', label: 'Holidays' },
] as const;

/** Settings pages share a header and section tabs; only administrators may enter. */
export function SettingsFrame({ children }: { readonly children: ReactNode }) {
  const pathname = usePathname();
  const { can } = useSession();
  if (!can('organization.manage_settings', 'roles.manage')) {
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
          description="How the studio works: its details, who can do what, and the days it is closed."
        />
      </motion.div>
      <TabNav
        label="Settings sections"
        link={Link}
        items={SECTIONS.map((section) => ({
          href: section.href,
          label: section.label,
          active: pathname === section.href,
        }))}
      />
      <div>{children}</div>
    </div>
  );
}
