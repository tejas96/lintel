import type { Metadata } from 'next';
import { CapacityView } from '@/features/capacity/capacity-view';

export const metadata: Metadata = { title: 'Capacity' };

export default function CapacityPage() {
  return <CapacityView />;
}
