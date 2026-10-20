'use client';

import { CircleAlert } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { createContext, type ReactNode, useContext, useId } from 'react';
import { cn } from '../lib/cn';

interface FieldContextValue {
  readonly id: string;
  readonly describedBy: string | undefined;
  readonly invalid: boolean;
  readonly required: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

/** Inputs inside a Field pick up its id, description and error state. */
export function useField(): FieldContextValue | null {
  return useContext(FieldContext);
}

interface FieldProps {
  readonly label: ReactNode;
  readonly hint?: ReactNode;
  readonly error?: string | null | undefined;
  readonly required?: boolean;
  /** Hide the label visually but keep it for assistive technology. */
  readonly hideLabel?: boolean;
  readonly className?: string;
  readonly children: ReactNode;
}

export function Field({
  label,
  hint,
  error,
  required = false,
  hideLabel = false,
  className,
  children,
}: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <FieldContext.Provider value={{ id, describedBy, invalid: Boolean(error), required }}>
      <div className={cn('flex flex-col gap-1.5', className)}>
        <label htmlFor={id} className={cn('type-label text-ink-muted', hideLabel && 'sr-only')}>
          {label}
          {required && <span className="ml-0.5 text-ink-faint">(required)</span>}
        </label>
        {children}
        {hint && !error && (
          <p id={hintId} className="type-body-sm text-ink-faint">
            {hint}
          </p>
        )}
        <AnimatePresence initial={false}>
          {error && (
            <motion.p
              key="error"
              id={errorId}
              role="alert"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-start gap-1.5 type-body-sm text-overdue"
            >
              <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </FieldContext.Provider>
  );
}

/** Shared look of text-like controls: paper well, hairline, accent focus. */
export const controlSurface = cn(
  'w-full rounded-md border border-rule bg-raised text-ink shadow-[inset_0_1px_0_rgb(0_0_0/0.02)]',
  'placeholder:text-ink-faint transition-[border-color,box-shadow] duration-(--duration-fast) ease-standard',
  'hover:border-ink-faint focus-visible:border-accent focus-visible:outline-none',
  'focus-visible:ring-[3px] focus-visible:ring-accent/20',
  'aria-invalid:border-overdue aria-invalid:focus-visible:ring-overdue/20',
  'disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-faint',
);
