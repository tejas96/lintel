import type { Metadata } from 'next';
import { LeaveReportView } from '@/features/reports/leave-report';

export const metadata: Metadata = { title: 'Leave taken' };

export default function LeaveReportPage() {
  return <LeaveReportView />;
}
