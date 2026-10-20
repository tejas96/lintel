'use client';

import { Avatar, cn, IconButton, Sheet, snappySpring } from '@lintel/design-system/web';
import { Ellipsis, Search } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useState } from 'react';
import { LintelMark } from '@/features/auth/brand-mark';
import { useSession } from '@/features/session/session-provider';
import type { NavItem } from './navigation';
import { NotificationsBell } from './notifications-bell';
import { PreferencesPanel } from './preferences-panel';

const MAX_TABS = 5;

/** Phone header: mark, search, notifications and the account sheet. */
export function MobileTopBar({ onOpenPalette }: { readonly onOpenPalette: () => void }) {
  const { user } = useSession();
  const [accountOpen, setAccountOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-1 border-b border-hairline bg-canvas/90 px-3 pt-[env(safe-area-inset-top)] backdrop-blur-md md:hidden">
      <Link
        href="/today"
        aria-label="Lintel, go to Today"
        className="flex items-center gap-2 rounded-sm px-1 text-ink"
      >
        <LintelMark />
        <span className="max-w-[10rem] truncate type-title-md">{user.organizationName}</span>
      </Link>
      <span className="flex-1" />
      <IconButton label="Search and jump to" onClick={onOpenPalette}>
        <Search aria-hidden />
      </IconButton>
      <NotificationsBell />
      <button
        type="button"
        aria-label="Your account and preferences"
        onClick={() => setAccountOpen(true)}
        className="flex size-11 items-center justify-center rounded-full"
      >
        <Avatar name={user.fullName} hue={user.avatarHue} size="sm" decorative />
      </button>
      <Sheet open={accountOpen} onOpenChange={setAccountOpen} side="bottom" title="Account">
        <div className="p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <PreferencesPanel />
        </div>
      </Sheet>
    </header>
  );
}

/** Phone navigation along the bottom edge, within thumb reach. */
export function MobileTabBar({
  items,
  activeId,
}: {
  readonly items: readonly NavItem[];
  readonly activeId: string | null;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const needsMore = items.length > MAX_TABS;
  const tabs = needsMore ? items.slice(0, MAX_TABS - 1) : items;
  const overflow = needsMore ? items.slice(MAX_TABS - 1) : [];
  const overflowActive = overflow.some((item) => item.id === activeId);
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-raised/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <ul className="flex">
        {tabs.map((item) => (
          <li key={item.id} className="relative flex-1">
            <TabLink item={item} active={item.id === activeId} />
          </li>
        ))}
        {needsMore && (
          <li className="relative flex-1">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className={cn(
                'flex h-16 w-full flex-col items-center justify-center gap-1 text-[0.6875rem]',
                overflowActive ? 'text-ink' : 'text-ink-muted',
              )}
            >
              <Ellipsis aria-hidden className="size-5" />
              More
            </button>
          </li>
        )}
      </ul>
      {needsMore && (
        <Sheet open={moreOpen} onOpenChange={setMoreOpen} side="bottom" title="More">
          <ul className="flex flex-col p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {overflow.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className="flex h-12 items-center gap-3 rounded-md px-3 type-body text-ink hover:bg-sunken"
                >
                  <item.icon aria-hidden className="size-5 text-ink-faint" strokeWidth={1.75} />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </Sheet>
      )}
    </nav>
  );
}

function TabLink({ item, active }: { readonly item: NavItem; readonly active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex h-16 flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium',
        active ? 'text-ink' : 'text-ink-muted',
      )}
    >
      {active && (
        <motion.span
          layoutId="tabbar-active"
          transition={snappySpring}
          className="absolute top-0 h-0.5 w-8 rounded-full bg-accent"
        />
      )}
      <Icon aria-hidden className={cn('size-5', active && 'text-accent')} strokeWidth={1.75} />
      {item.label}
    </Link>
  );
}
