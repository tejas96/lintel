import type { Metadata } from 'next';
import { PoliciesView } from '@/features/rewards/policies-view';

export const metadata: Metadata = { title: 'Reward policies' };

export default function RewardPoliciesPage() {
  return <PoliciesView />;
}
