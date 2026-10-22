import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { GuidanceSeed } from '@/features/guidance/guidance-seed';
import { SessionProvider } from '@/features/session/session-provider';
import { lookUpGuidance } from '@/lib/api/server-guidance';
import { lookUpSession } from '@/lib/api/server-session';
import { AppShell } from '@/shell/app-shell';
import { ServerUnreachable } from '@/shell/server-unreachable';

interface AppLayoutProps {
  readonly children: ReactNode;
  /** Parallel route: task details opened over the current page. */
  readonly drawer: ReactNode;
}

export default async function AppLayout({ children, drawer }: AppLayoutProps) {
  const [session, guidance] = await Promise.all([lookUpSession(), lookUpGuidance()]);
  if (session.status === 'signed-out') {
    const path = (await headers()).get('x-lintel-path') ?? '/today';
    redirect(`/sign-in?next=${encodeURIComponent(path)}&expired=1`);
  }
  if (session.status === 'unreachable') return <ServerUnreachable requestId={session.requestId} />;
  return (
    <SessionProvider user={session.user}>
      <GuidanceSeed guidance={guidance}>
        <AppShell drawer={drawer}>{children}</AppShell>
      </GuidanceSeed>
    </SessionProvider>
  );
}
