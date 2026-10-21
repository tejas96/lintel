import type { Metadata } from 'next';
import { RewardReview } from '@/features/rewards/reward-review';

export const metadata: Metadata = { title: 'Review rewards' };

export default function RewardReviewPage() {
  return <RewardReview />;
}
