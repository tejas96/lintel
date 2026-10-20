import type { Metadata } from 'next';
import { DeliverablePage } from '@/features/deliverables/deliverable-page';

export const metadata: Metadata = { title: 'Deliverable' };

export default async function DeliverableRoute({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DeliverablePage deliverableId={id} />;
}
