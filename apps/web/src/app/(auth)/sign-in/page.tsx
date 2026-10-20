import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { BrandPanel } from '@/features/auth/brand-panel';
import { SignInFlow } from '@/features/auth/sign-in-flow';
import { lookUpSession, safeReturnPath } from '@/lib/api/server-session';

export const metadata: Metadata = { title: 'Sign in' };

interface SignInPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const returnTo = safeReturnPath(typeof params.next === 'string' ? params.next : null);
  const session = await lookUpSession();
  if (session.status === 'signed-in') redirect(returnTo);

  return (
    <main className="grid min-h-dvh md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <BrandPanel />
      <div className="flex flex-col bg-canvas">
        <div className="flex flex-1 items-center justify-center px-6 py-10 sm:px-12">
          <SignInFlow returnTo={returnTo} sessionEnded={params.expired === '1'} />
        </div>
        <p className="px-6 pb-6 text-center type-body-sm text-ink-faint sm:px-12">
          Trouble signing in? Your studio administrator can check the number on your account.
        </p>
      </div>
    </main>
  );
}
