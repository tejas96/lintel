import type { Metadata } from 'next';
import { DeliveryReportView } from '@/features/reports/delivery-report';

export const metadata: Metadata = { title: 'Delivery reliability' };

export default function DeliveryReportPage() {
  return <DeliveryReportView />;
}
