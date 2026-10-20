import type { Metadata } from 'next';
import { LeaveDecisionPage } from '@/features/leave/decision/leave-decision-page';

export const metadata: Metadata = { title: 'Leave request' };

export default async function LeaveRequestPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <LeaveDecisionPage requestId={id} />;
}
