import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { SessionProvider } from '@/features/session/session-provider';
import { lookUpSession } from '@/lib/api/server-session';
import { AppShell } from '@/shell/app-shell';
import { ServerUnreachable } from '@/shell/server-unreachable';

interface AppLayoutProps {
  readonly children: ReactNode;
  /** Parallel route: task details opened over the current page. */
  readonly drawer: ReactNode;
}

export default async function AppLayout({ children, drawer }: AppLayoutProps) {
  const session = await lookUpSession();
  if (session.status === 'signed-out') {
    const path = (await headers()).get('x-lintel-path') ?? '/today';
    redirect(`/sign-in?next=${encodeURIComponent(path)}&expired=1`);
  }
  if (session.status === 'unreachable') return <ServerUnreachable requestId={session.requestId} />;
  return (
    <SessionProvider user={session.user}>
      <AppShell drawer={drawer}>{children}</AppShell>
    </SessionProvider>
  );
}
