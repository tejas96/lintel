'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { layoutSpring } from '../motion/presets';
import { Avatar } from './avatar';

interface ApprovalCardProps {
  /** What kind of decision this is ("Deliverable review"). */
  readonly kind: string;
  readonly title: ReactNode;
  readonly subtitle?: ReactNode;
  readonly requestedBy?: { readonly fullName: string; readonly avatarHue: number } | null;
  /** Already-formatted, e.g. "2 hours ago". */
  readonly requestedWhen?: string;
  /** A file preview or swatch that the decision is about. */
  readonly preview?: ReactNode;
  readonly urgent?: boolean;
  /** The decision buttons. */
  readonly actions: ReactNode;
  /** Extra input for the decision, such as a comment field, shown above the buttons. */
  readonly children?: ReactNode;
  readonly className?: string;
}

/** A decision waiting on someone: what, who asked, the evidence, and the choices. */
export function ApprovalCard({
  kind,
  title,
  subtitle,
  requestedBy,
  requestedWhen,
  preview,
  urgent = false,
  actions,
  children,
  className,
}: ApprovalCardProps) {
  return (
    <motion.article
      layout
      transition={layoutSpring}
      className={cn(
        'flex flex-col overflow-hidden rounded-lg border bg-raised',
        urgent ? 'border-at-risk-solid/50' : 'border-hairline',
        className,
      )}
    >
      {preview && <div className="border-b border-hairline bg-sunken">{preview}</div>}
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-3 type-body-sm text-ink-faint">
          <span>{kind}</span>
          {urgent && <span className="font-medium text-at-risk">Needs a decision soon</span>}
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="type-title-md text-ink">{title}</h3>
          {subtitle && <p className="type-body-sm text-ink-muted">{subtitle}</p>}
        </div>
        {requestedBy && (
          <p className="flex items-center gap-2 type-body-sm text-ink-muted">
            <Avatar name={requestedBy.fullName} hue={requestedBy.avatarHue} size="xs" decorative />
            <span>
              {requestedBy.fullName}
              {requestedWhen && <span className="text-ink-faint">, {requestedWhen}</span>}
            </span>
          </p>
        )}
        {children}
        <div className="flex flex-wrap gap-2 pt-1">{actions}</div>
      </div>
    </motion.article>
  );
}
