import type { Metadata } from 'next';
import { EstimatesReportView } from '@/features/reports/estimates-report';

export const metadata: Metadata = { title: 'Estimate accuracy' };

export default function EstimatesReportPage() {
  return <EstimatesReportView />;
}
