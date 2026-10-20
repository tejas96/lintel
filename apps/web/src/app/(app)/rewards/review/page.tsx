import type { Metadata } from 'next';
import { ReviewQueue } from '@/features/rewards/review-queue';

export const metadata: Metadata = { title: 'Review rewards' };

export default function RewardReviewPage() {
  return <ReviewQueue />;
}
