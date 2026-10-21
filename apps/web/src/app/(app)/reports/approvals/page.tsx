import type { Metadata } from 'next';
import { ApprovalsReportView } from '@/features/reports/approvals-report';

export const metadata: Metadata = { title: 'Approvals turnaround' };

export default function ApprovalsReportPage() {
  return <ApprovalsReportView />;
}
