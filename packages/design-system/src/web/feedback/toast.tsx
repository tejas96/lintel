'use client';

import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Toast as ToastPrimitive } from 'radix-ui';
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { cn } from '../lib/cn';
import { easing, layoutSpring, seconds } from '../motion/presets';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastInput {
  readonly title: string;
  readonly description?: string;
  readonly tone?: ToastTone;
  /** Shown in small print on errors so support can find the request. */
  readonly reference?: string;
  readonly action?: { readonly label: string; readonly onSelect: () => void };
  readonly durationMs?: number;
}

interface ToastEntry extends ToastInput {
  readonly id: number;
}

const ToastContext = createContext<(input: ToastInput) => void>(() => undefined);

/** Show a toast from anywhere inside ToastProvider. */
export function useToast(): (input: ToastInput) => void {
  return useContext(ToastContext);
}

const TONE_ICON = {
  success: { icon: CircleCheck, className: 'text-on-track' },
  error: { icon: CircleAlert, className: 'text-overdue' },
  info: { icon: Info, className: 'text-accent' },
} as const;

let nextToastId = 1;

export function ToastProvider({ children }: { readonly children: ReactNode }) {
  const [toasts, setToasts] = useState<readonly ToastEntry[]>([]);
  const show = useCallback((input: ToastInput) => {
    const entry = { ...input, id: nextToastId++ };
    setToasts((current) => [...current.slice(-2), entry]);
  }, []);
  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);
  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      <ToastPrimitive.Provider swipeDirection="right" duration={5000}>
        {children}
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
          ))}
        </AnimatePresence>
        <ToastPrimitive.Viewport
          className={cn(
            'fixed z-[60] flex w-full flex-col gap-2 p-3 outline-none sm:max-w-sm',
            'right-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-0 md:p-5',
          )}
        />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  readonly toast: ToastEntry;
  readonly onDismiss: () => void;
}) {
  const tone = TONE_ICON[toast.tone ?? 'info'];
  const Icon = tone.icon;
  return (
    <ToastPrimitive.Root
      asChild
      forceMount
      duration={toast.durationMs ?? (toast.tone === 'error' ? 8000 : 5000)}
      onOpenChange={(open) => {
        if (!open) onDismiss();
      }}
    >
      <motion.li
        layout
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, x: 24, transition: { duration: seconds('fast'), ease: easing('in') } }}
        transition={layoutSpring}
        className="flex items-start gap-3 rounded-lg border border-hairline bg-raised p-3.5 pr-2 shadow-e3"
      >
        <Icon aria-hidden className={cn('mt-0.5 size-[1.125rem] shrink-0', tone.className)} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <ToastPrimitive.Title className="type-title-md text-ink">
            {toast.title}
          </ToastPrimitive.Title>
          {toast.description && (
            <ToastPrimitive.Description className="type-body-sm text-ink-muted">
              {toast.description}
            </ToastPrimitive.Description>
          )}
          {toast.reference && (
            <p className="type-mono text-ink-faint">Reference {toast.reference}</p>
          )}
          {toast.action && (
            <ToastPrimitive.Action
              altText={toast.action.label}
              onClick={toast.action.onSelect}
              className="mt-1.5 self-start rounded-sm type-label text-accent underline-offset-4 hover:underline"
            >
              {toast.action.label}
            </ToastPrimitive.Action>
          )}
        </div>
        <ToastPrimitive.Close
          aria-label="Dismiss"
          className="flex size-8 items-center justify-center rounded-md text-ink-faint hover:bg-sunken hover:text-ink"
        >
          <X aria-hidden className="size-4" />
        </ToastPrimitive.Close>
      </motion.li>
    </ToastPrimitive.Root>
  );
}
