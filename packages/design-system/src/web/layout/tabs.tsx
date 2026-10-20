'use client';

import { motion } from 'motion/react';
import { Tabs as TabsPrimitive } from 'radix-ui';
import { type ComponentType, type ReactNode, useId } from 'react';
import { cn } from '../lib/cn';
import { snappySpring } from '../motion/presets';

export interface TabItem<TValue extends string> {
  readonly value: TValue;
  readonly label: string;
  readonly count?: number;
}

interface TabsProps<TValue extends string> {
  readonly value: TValue;
  readonly onValueChange: (value: TValue) => void;
  readonly items: readonly TabItem<TValue>[];
  readonly label: string;
  readonly children: ReactNode;
  readonly className?: string;
}

/** In-page tabs with an underline that slides to the selected tab. */
export function Tabs<TValue extends string>({
  value,
  onValueChange,
  items,
  label,
  children,
  className,
}: TabsProps<TValue>) {
  const indicatorId = useId();
  return (
    <TabsPrimitive.Root
      value={value}
      onValueChange={(next) => {
        const item = items.find((candidate) => candidate.value === next);
        if (item) onValueChange(item.value);
      }}
      className={className}
    >
      <TabsPrimitive.List
        aria-label={label}
        className="flex gap-1 overflow-x-auto border-b border-hairline [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => (
          <TabsPrimitive.Trigger
            key={item.value}
            value={item.value}
            className="relative flex h-11 shrink-0 items-center gap-1.5 px-3 type-body text-ink-muted transition-colors hover:text-ink data-[state=active]:text-ink"
          >
            {item.label}
            {item.count !== undefined && (
              <span className="type-body-sm text-ink-faint tabular-nums">{item.count}</span>
            )}
            {item.value === value && (
              <motion.span
                layoutId={indicatorId}
                transition={snappySpring}
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent"
              />
            )}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {children}
    </TabsPrimitive.Root>
  );
}

export const TabPanel = TabsPrimitive.Content;

export interface NavTabItem {
  readonly href: string;
  readonly label: string;
  readonly active: boolean;
}

export type LinkLike = ComponentType<{
  href: string;
  className?: string;
  children: ReactNode;
  'aria-current'?: 'page';
}>;

/** Tabs that are links (each tab is its own URL), for routed sections. */
export function TabNav({
  items,
  label,
  link: Link,
  className,
}: {
  readonly items: readonly NavTabItem[];
  readonly label: string;
  readonly link: LinkLike;
  readonly className?: string;
}) {
  const indicatorId = useId();
  return (
    <nav
      aria-label={label}
      className={cn(
        '-mx-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      <ul className="flex min-w-max gap-1 border-b border-hairline px-1">
        {items.map((item) => (
          <li key={item.href} className="relative">
            <Link
              href={item.href}
              {...(item.active ? { 'aria-current': 'page' as const } : {})}
              className={cn(
                'flex h-11 items-center px-3 type-body transition-colors',
                item.active ? 'text-ink' : 'text-ink-muted hover:text-ink',
              )}
            >
              {item.label}
            </Link>
            {item.active && (
              <motion.span
                layoutId={indicatorId}
                transition={snappySpring}
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent"
              />
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
