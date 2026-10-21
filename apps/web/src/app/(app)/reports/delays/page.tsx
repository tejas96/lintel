import type { Metadata } from 'next';
import { DelaysReportView } from '@/features/reports/delays-report';

export const metadata: Metadata = { title: 'Approval delays' };

export default function DelaysReportPage() {
  return <DelaysReportView />;
}
