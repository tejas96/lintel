import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SettingsFrame } from '@/features/settings/settings-frame';

export const metadata: Metadata = { title: 'Settings' };

export default function SettingsLayout({ children }: { readonly children: ReactNode }) {
  return <SettingsFrame>{children}</SettingsFrame>;
}
