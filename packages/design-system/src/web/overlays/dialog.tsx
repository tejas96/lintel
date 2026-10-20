'use client';

import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import type { ReactNode } from 'react';
import { IconButton } from '../controls/button';
import { cn } from '../lib/cn';
import { dialogEnter, seconds } from '../motion/presets';

interface DialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly children?: ReactNode;
  /** Actions, right-aligned under the content. */
  readonly footer?: ReactNode;
  readonly size?: 'sm' | 'md' | 'lg';
}

const WIDTHS = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl' } as const;

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
}: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-scrim backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: seconds('base') }}
              />
            </DialogPrimitive.Overlay>
            <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-6">
              <DialogPrimitive.Content asChild forceMount>
                <motion.div
                  {...dialogEnter}
                  className={cn(
                    'pointer-events-auto relative flex max-h-[min(90dvh,48rem)] w-full flex-col overflow-hidden',
                    'rounded-xl border border-hairline bg-raised shadow-e4',
                    WIDTHS[size],
                  )}
                >
                  <header className="flex items-start gap-4 px-6 pt-6 pb-2">
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <DialogPrimitive.Title className="type-display-md text-ink">
                        {title}
                      </DialogPrimitive.Title>
                      {description ? (
                        <DialogPrimitive.Description className="type-body text-ink-muted">
                          {description}
                        </DialogPrimitive.Description>
                      ) : (
                        <DialogPrimitive.Description className="sr-only">
                          {title}
                        </DialogPrimitive.Description>
                      )}
                    </div>
                    <DialogPrimitive.Close asChild>
                      <IconButton label="Close" size="sm" className="-mt-1 -mr-2">
                        <X aria-hidden />
                      </IconButton>
                    </DialogPrimitive.Close>
                  </header>
                  {children && <div className="overflow-y-auto px-6 py-3">{children}</div>}
                  {footer && (
                    <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-hairline bg-surface px-6 py-4">
                      {footer}
                    </footer>
                  )}
                </motion.div>
              </DialogPrimitive.Content>
            </div>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
