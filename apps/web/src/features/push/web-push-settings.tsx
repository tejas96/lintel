'use client';

import { Button } from '@lintel/design-system/web';
import { BellOff, BellRing, MonitorSmartphone } from 'lucide-react';
import type { ReactNode } from 'react';
import { useWebPush, type WebPushState } from './use-web-push';

const COPY: Readonly<
  Record<Exclude<WebPushState, 'checking' | 'hidden'>, { title: string; body: string }>
> = {
  off: {
    title: 'Notifications in this browser',
    body: 'Get a nudge on this computer when something needs you, even while Lintel is closed. Your browser will ask first.',
  },
  on: {
    title: 'On for this browser',
    body: 'Pushes you allow above also arrive here. Signing out stops them on this computer.',
  },
  blocked: {
    title: 'This browser blocks Lintel’s notifications',
    body: 'Allow notifications for this site in the browser’s site settings (the icon beside the address), then reload this page.',
  },
  unsupported: {
    title: 'Not available in this browser',
    body: 'This browser can’t receive notifications from Lintel. A current Chrome, Edge, Firefox or Safari can.',
  },
};

function Icon({ state }: { readonly state: WebPushState }): ReactNode {
  const className = 'size-5';
  if (state === 'on') return <BellRing aria-hidden className={className} />;
  if (state === 'blocked') return <BellOff aria-hidden className={className} />;
  return <MonitorSmartphone aria-hidden className={className} />;
}

/**
 * Push to this browser. The permission prompt only appears when the person
 * presses the button here, never on page load. Hidden entirely when the
 * studio has no Firebase web configuration.
 */
export function WebPushSettings() {
  const { state, working, enable, disable } = useWebPush();
  if (state === 'checking' || state === 'hidden') return null;
  const copy = COPY[state];
  const highlighted = state === 'on';
  return (
    <section
      aria-labelledby="web-push-title"
      className="flex flex-col gap-4 rounded-lg border border-hairline bg-raised p-5 sm:flex-row sm:items-center"
    >
      <span
        className={
          highlighted
            ? 'flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-on-accent-soft'
            : 'flex size-10 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-muted'
        }
      >
        <Icon state={state} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 id="web-push-title" className="type-title-md text-ink">
          {copy.title}
        </h3>
        <p className="type-body-sm text-ink-muted">{copy.body}</p>
      </div>
      {state === 'off' && (
        <Button variant="primary" pending={working} onClick={() => void enable()}>
          Turn on in this browser
        </Button>
      )}
      {state === 'on' && (
        <Button variant="secondary" pending={working} onClick={() => void disable()}>
          Turn off
        </Button>
      )}
    </section>
  );
}
