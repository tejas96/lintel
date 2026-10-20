'use client';

import { Avatar, cn, Popover, snappySpring } from '@lintel/design-system/web';
import { ROLE_LABELS } from '@lintel/domain';
import { ChevronsUpDown, Search } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { Wordmark } from '@/features/auth/brand-mark';
import { useSession } from '@/features/session/session-provider';
import type { NavItem } from './navigation';
import { NotificationsBell } from './notifications-bell';
import { PreferencesPanel } from './preferences-panel';

interface SidebarProps {
  readonly items: readonly NavItem[];
  readonly activeId: string | null;
  readonly onOpenPalette: () => void;
}

/** Desktop navigation, sitting on the canvas beside the page's sheet. */
export function Sidebar({ items, activeId, onOpenPalette }: SidebarProps) {
  const { user } = useSession();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[15.5rem] flex-col px-3 pt-4 pb-3 md:flex">
      <div className="flex h-11 items-center justify-between pl-2.5">
        <Link href="/today" className="rounded-sm text-ink" aria-label="Lintel, go to Today">
          <Wordmark />
        </Link>
        <NotificationsBell />
      </div>
      <p className="truncate px-2.5 type-body-sm text-ink-faint">{user.organizationName}</p>

      <button
        type="button"
        onClick={onOpenPalette}
        className="mt-5 flex h-10 items-center gap-2.5 rounded-md border border-hairline bg-surface px-3 text-left type-body-sm text-ink-faint transition-colors hover:border-rule hover:text-ink-muted"
      >
        <Search aria-hidden className="size-4" />
        <span className="flex-1">Jump to…</span>
        <kbd className="rounded-[4px] border border-hairline bg-raised px-1.5 font-sans text-[0.6875rem] text-ink-faint">
          ⌘K
        </kbd>
      </button>

      <nav aria-label="Main" className="mt-5 flex-1 overflow-y-auto">
        <ul className="flex flex-col gap-0.5">
          {items.map((item) => {
            const active = item.id === activeId;
            const Icon = item.icon;
            return (
              <li key={item.id} className="relative">
                {active && (
                  <motion.span
                    layoutId="sidebar-active"
                    transition={snappySpring}
                    className="absolute inset-0 rounded-md border border-hairline bg-raised shadow-e1"
                  />
                )}
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative flex h-10 items-center gap-3 rounded-md px-2.5 type-body transition-colors pointer-coarse:h-11',
                    active
                      ? 'font-medium text-ink'
                      : 'text-ink-muted hover:bg-sunken/70 hover:text-ink',
                  )}
                >
                  <Icon
                    aria-hidden
                    className={cn('size-[1.125rem]', active ? 'text-accent' : 'text-ink-faint')}
                    strokeWidth={1.75}
                  />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <Popover
        label="Your account and preferences"
        side="top"
        align="start"
        className="w-[18rem] p-4"
        trigger={
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-sunken/70"
          >
            <Avatar name={user.fullName} hue={user.avatarHue} size="sm" decorative />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate type-body-sm font-medium text-ink">{user.fullName}</span>
              <span className="truncate text-[0.75rem] text-ink-faint">
                {ROLE_LABELS[user.role]}
              </span>
            </span>
            <ChevronsUpDown aria-hidden className="size-4 text-ink-faint" />
          </button>
        }
      >
        <PreferencesPanel />
      </Popover>
    </aside>
  );
}
