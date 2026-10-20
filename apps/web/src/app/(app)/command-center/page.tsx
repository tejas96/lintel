import type { Metadata } from 'next';
import { CommandCenterView } from '@/features/command-center/command-center-view';

export const metadata: Metadata = { title: 'Command center' };

export default function CommandCenterPage() {
  return <CommandCenterView />;
}
