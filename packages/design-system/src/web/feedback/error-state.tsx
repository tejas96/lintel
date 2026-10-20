'use client';

import { Check, Copy, RotateCw } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Button } from '../controls/button';
import type { DrawingName } from '../illustrations/drawings';
import { EmptyState } from './empty-state';

export type ErrorKind = 'error' | 'forbidden' | 'notFound' | 'unavailable' | 'offline' | 'stale';

const DRAWING_FOR_KIND: Readonly<Record<ErrorKind, DrawingName>> = {
  error: 'lintelRaising',
  forbidden: 'doorway',
  notFound: 'plan',
  unavailable: 'lintelRaising',
  offline: 'lamp',
  stale: 'drafting',
};

interface ErrorStateProps {
  readonly kind?: ErrorKind;
  readonly title: ReactNode;
  readonly message: ReactNode;
  /** The server request id, shown so support can trace the failure. */
  readonly requestId?: string | null;
  readonly onRetry?: () => void;
  readonly retryLabel?: string;
  readonly retrying?: boolean;
  readonly actions?: ReactNode;
  readonly size?: 'section' | 'page';
}

export function ErrorState({
  kind = 'error',
  title,
  message,
  requestId,
  onRetry,
  retryLabel = 'Try again',
  retrying = false,
  actions,
  size = 'page',
}: ErrorStateProps) {
  return (
    <div role={kind === 'error' || kind === 'offline' ? 'alert' : undefined}>
      <EmptyState
        drawing={DRAWING_FOR_KIND[kind]}
        title={title}
        description={message}
        size={size}
        actions={
          (onRetry || actions) && (
            <>
              {onRetry && (
                <Button onClick={onRetry} pending={retrying} leadingIcon={<RotateCw aria-hidden />}>
                  {retryLabel}
                </Button>
              )}
              {actions}
            </>
          )
        }
      >
        {requestId && <RequestReference requestId={requestId} />}
      </EmptyState>
    </div>
  );
}

function RequestReference({ requestId }: { readonly requestId: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(requestId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex min-h-9 items-center gap-2 rounded-md border border-hairline bg-surface px-2.5 type-mono text-ink-faint hover:text-ink-muted"
      aria-label={`Copy reference ${requestId}`}
    >
      <span>Reference {requestId.slice(0, 8)}</span>
      {copied ? (
        <Check aria-hidden className="size-3.5 text-on-track" />
      ) : (
        <Copy aria-hidden className="size-3.5" />
      )}
      <span className="sr-only" aria-live="polite">
        {copied ? 'Copied' : ''}
      </span>
    </button>
  );
}
