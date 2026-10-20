'use client';

import { ErrorState, PageHeader, pageEnter, TabNav } from '@lintel/design-system/web';
import type { Capability } from '@lintel/domain';
import { motion } from 'motion/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useSession } from '@/features/session/session-provider';

const SECTIONS: readonly { href: string; label: string; requires: readonly Capability[] }[] = [
  { href: '/rewards', label: 'My recognition', requires: ['rewards.view_own', 'rewards.view_all'] },
  { href: '/rewards/review', label: 'Review', requires: ['rewards.decide'] },
  { href: '/rewards/policies', label: 'Policies', requires: ['rewards.manage_policies'] },
];

/** Rewards share a header; each person sees only the sections they can use. */
export function RewardsFrame({ children }: { readonly children: ReactNode }) {
  const pathname = usePathname();
  const { can } = useSession();
  const sections = SECTIONS.filter((section) => can(...section.requires));
  const current = SECTIONS.find((section) => section.href === pathname);
  const allowed = current ? can(...current.requires) : true;
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-7 px-5 py-6 md:px-10 md:py-9">
      <motion.div {...pageEnter}>
        <PageHeader
          title="Rewards"
          description="Recognition for dependable work, worked out from what was delivered and decided by a person."
        />
      </motion.div>
      {sections.length > 1 && (
        <TabNav
          label="Rewards sections"
          link={Link}
          items={sections.map((section) => ({
            href: section.href,
            label: section.label,
            active: pathname === section.href,
          }))}
        />
      )}
      {allowed ? (
        <div>{children}</div>
      ) : (
        <ErrorState
          kind="forbidden"
          title="This part of rewards isn’t open to you"
          message="Reviewing rewards and changing policies are for the people the owner chose. Ask the studio owner if you need it."
        />
      )}
    </div>
  );
}
