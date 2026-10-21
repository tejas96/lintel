'use client';

import { usePathname } from 'next/navigation';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useWebPushLifecycle } from '@/features/push/use-web-push';
import { useSession } from '@/features/session/session-provider';
import { CommandPalette } from './command-palette';
import { MobileTabBar, MobileTopBar } from './mobile-bars';
import { activeNavId, visibleNavItems } from './navigation';
import { Sidebar } from './sidebar';
import { useHeartbeat } from './use-heartbeat';

/**
 * One shell for every role: sidebar on wide screens, top and bottom bars on
 * phones, the page itself on a paper sheet laid over the linen canvas.
 */
export function AppShell({
  children,
  drawer,
}: {
  readonly children: ReactNode;
  readonly drawer: ReactNode;
}) {
  const { can } = useSession();
  const pathname = usePathname();
  const items = useMemo(() => visibleNavItems(can), [can]);
  const activeId = activeNavId(pathname, items);
  const [paletteOpen, setPaletteOpen] = useState(false);
  useHeartbeat();
  useWebPushLifecycle();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="min-h-dvh bg-canvas">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-raised px-4 py-2 text-ink shadow-e3 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <Sidebar items={items} activeId={activeId} onOpenPalette={() => setPaletteOpen(true)} />
      <MobileTopBar onOpenPalette={() => setPaletteOpen(true)} />
      <div className="md:py-2 md:pr-2 md:pl-[15.5rem]">
        <main
          id="main"
          tabIndex={-1}
          className="min-h-[calc(100dvh-3.5rem)] bg-surface pb-24 outline-none md:min-h-[calc(100dvh-1rem)] md:rounded-xl md:border md:border-hairline md:pb-0 md:shadow-e1"
        >
          {children}
        </main>
      </div>
      <MobileTabBar items={items} activeId={activeId} />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      {drawer}
    </div>
  );
}
