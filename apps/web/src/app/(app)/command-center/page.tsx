import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CommandCenterView } from '@/features/command-center/command-center-view';

export const metadata: Metadata = { title: 'Command center' };

export default function CommandCenterPage() {
  return (
    <Suspense>
      <CommandCenterView />
    </Suspense>
  );
}
