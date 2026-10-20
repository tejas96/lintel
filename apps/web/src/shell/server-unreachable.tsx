'use client';

import { ErrorState } from '@lintel/design-system/web';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Wordmark } from '@/features/auth/brand-mark';

/** Shown instead of the app when the API cannot confirm the session. */
export function ServerUnreachable({ requestId }: { readonly requestId: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <main className="flex min-h-dvh flex-col bg-canvas">
      <div className="px-6 pt-6 text-ink">
        <Wordmark />
      </div>
      <div className="flex flex-1 items-center justify-center">
        <ErrorState
          kind="offline"
          title="Lintel can’t reach the studio server"
          message="Your work is safe. Check your connection; if it’s fine, the server may be restarting. Try again in a minute."
          requestId={requestId}
          onRetry={() => startTransition(() => router.refresh())}
          retrying={pending}
        />
      </div>
    </main>
  );
}
