import type { Metadata } from 'next';
import { type ReactNode, Suspense } from 'react';
import { ReportsFrame } from '@/features/reports/reports-frame';

// Keeps the studio suffix on the section's own page titles.
export const metadata: Metadata = { title: { default: 'Reports', template: '%s · Lintel' } };

export default function ReportsLayout({ children }: { readonly children: ReactNode }) {
  return (
    <Suspense>
      <ReportsFrame>{children}</ReportsFrame>
    </Suspense>
  );
}
