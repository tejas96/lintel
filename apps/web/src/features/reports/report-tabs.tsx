'use client';

import { type NavTabItem, TabNav } from '@lintel/design-system/web';
import Link from 'next/link';
import { useEffect, useRef } from 'react';

/**
 * The report tabs. Seven tabs are wider than a phone, so the row scrolls
 * sideways; when a report opens, its tab is scrolled into the middle of the
 * row so the current tab is never hidden off the edge.
 */
export function ReportTabs({
  items,
  activeKey,
}: {
  readonly items: readonly NavTabItem[];
  /** The open report, so the row recentres when it changes. */
  readonly activeKey: string | null;
}) {
  const frame = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (activeKey === null) return;
    const nav = frame.current?.querySelector('nav');
    const current = nav?.querySelector('[aria-current="page"]');
    if (!nav || !(current instanceof HTMLElement)) return;
    const row = nav.getBoundingClientRect();
    const tab = current.getBoundingClientRect();
    if (tab.left >= row.left && tab.right <= row.right) return;
    nav.scrollLeft += tab.left - row.left - (row.width - tab.width) / 2;
  }, [activeKey]);
  return (
    <div ref={frame} className="min-w-0">
      <TabNav label="Reports" link={Link} items={items} />
    </div>
  );
}
