import type { Metadata } from 'next';
import { WorkloadReportView } from '@/features/reports/workload-report';

export const metadata: Metadata = { title: 'Workload and capacity' };

export default function WorkloadReportPage() {
  return <WorkloadReportView />;
}
