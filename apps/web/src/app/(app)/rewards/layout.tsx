import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { RewardsFrame } from '@/features/rewards/rewards-frame';

// Keeps the studio suffix on the section's own page titles.
export const metadata: Metadata = { title: { default: 'Rewards', template: '%s · Lintel' } };

export default function RewardsLayout({ children }: { readonly children: ReactNode }) {
  return <RewardsFrame>{children}</RewardsFrame>;
}
