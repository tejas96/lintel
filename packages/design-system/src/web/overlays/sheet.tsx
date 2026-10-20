'use client';

import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import type { ReactNode } from 'react';
import { IconButton } from '../controls/button';
import { cn } from '../lib/cn';
import { seconds, sheetTransition } from '../motion/presets';
import { focusFirstField } from './focus-first-field';

interface SheetProps {
  /** Forms: start with the cursor in the first text field instead of on Close. */
  readonly autoFocusField?: boolean;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Called after the closing animation, e.g. to navigate back from a routed drawer. */
  readonly onExitComplete?: () => void;
  readonly title: ReactNode;
  readonly description?: ReactNode;
  /** Extra header content under the title (status, owner, etc.). */
  readonly header?: ReactNode;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  /** `right` drawers become full-screen on phones; `bottom` sheets rise from the bottom edge. */
  readonly side?: 'right' | 'bottom';
  readonly width?: 'md' | 'lg';
}

const PANEL = {
  right: {
    position: 'inset-y-0 right-0 w-full sm:inset-y-2 sm:right-2 sm:rounded-xl',
    from: { x: '100%' },
    to: { x: 0 },
  },
  bottom: {
    position: 'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-xl',
    from: { y: '100%' },
    to: { y: 0 },
  },
} as const;

const WIDTHS = { md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' } as const;

export function Sheet({
  open,
  onOpenChange,
  onExitComplete,
  title,
  description,
  header,
  children,
  footer,
  side = 'right',
  width = 'md',
  autoFocusField = false,
}: SheetProps) {
  const panel = PANEL[side];
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence {...(onExitComplete ? { onExitComplete } : {})}>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-scrim"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: seconds('base') }}
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content
              asChild
              forceMount
              {...(autoFocusField ? { onOpenAutoFocus: focusFirstField } : {})}
            >
              <motion.div
                initial={panel.from}
                animate={panel.to}
                exit={panel.from}
                transition={sheetTransition}
                className={cn(
                  'fixed z-50 flex flex-col overflow-clip border-hairline bg-surface shadow-e4 sm:border',
                  panel.position,
                  side === 'right' && WIDTHS[width],
                )}
              >
                {side === 'bottom' && (
                  <span aria-hidden className="mx-auto mt-2 h-1 w-10 rounded-full bg-rule" />
                )}
                <header className="flex items-start gap-3 border-b border-hairline px-5 pt-5 pb-4 sm:px-6">
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <DialogPrimitive.Title className="type-display-md text-ink">
                      {title}
                    </DialogPrimitive.Title>
                    {description ? (
                      <DialogPrimitive.Description className="type-body-sm text-ink-muted">
                        {description}
                      </DialogPrimitive.Description>
                    ) : (
                      <DialogPrimitive.Description className="sr-only">
                        {title}
                      </DialogPrimitive.Description>
                    )}
                    {header}
                  </div>
                  <DialogPrimitive.Close asChild>
                    <IconButton label="Close" size="sm" className="-mt-1 -mr-2">
                      <X aria-hidden />
                    </IconButton>
                  </DialogPrimitive.Close>
                </header>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
                {footer && (
                  <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-hairline bg-raised px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
                    {footer}
                  </footer>
                )}
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
