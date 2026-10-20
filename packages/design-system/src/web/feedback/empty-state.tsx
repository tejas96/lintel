'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import type { DrawingName } from '../illustrations/drawings';
import { LineDrawing } from '../illustrations/line-drawing';
import { cn } from '../lib/cn';
import { pageEnter } from '../motion/presets';

interface EmptyStateProps {
  readonly drawing?: DrawingName;
  readonly title: ReactNode;
  /** Say what to do next, not how the user should feel. */
  readonly description?: ReactNode;
  readonly actions?: ReactNode;
  /** `section` sits inside a card or list; `page` fills a screen. */
  readonly size?: 'section' | 'page';
  readonly className?: string;
  readonly children?: ReactNode;
}

export function EmptyState({
  drawing = 'drafting',
  title,
  description,
  actions,
  size = 'page',
  className,
  children,
}: EmptyStateProps) {
  const isPage = size === 'page';
  return (
    <motion.div
      {...pageEnter}
      className={cn(
        'flex flex-col items-center text-center',
        isPage ? 'gap-5 px-6 py-16 sm:py-24' : 'gap-3 px-4 py-8',
        className,
      )}
    >
      <LineDrawing name={drawing} className={isPage ? 'w-44' : 'w-28'} />
      <div className="flex max-w-md flex-col gap-2">
        <h2 className={cn('text-ink', isPage ? 'type-display-md' : 'type-title-md')}>{title}</h2>
        {description && (
          <p className={cn('text-ink-muted', isPage ? 'type-body' : 'type-body-sm')}>
            {description}
          </p>
        )}
      </div>
      {children}
      {actions && <div className="flex flex-wrap items-center justify-center gap-2">{actions}</div>}
    </motion.div>
  );
}
