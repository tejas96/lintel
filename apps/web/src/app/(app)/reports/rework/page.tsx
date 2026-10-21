import type { Metadata } from 'next';
import { ReworkReportView } from '@/features/reports/rework-report';

export const metadata: Metadata = { title: 'Rework rate' };

export default function ReworkReportPage() {
  return <ReworkReportView />;
}
