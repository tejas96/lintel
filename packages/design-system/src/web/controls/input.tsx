'use client';

import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cn } from '../lib/cn';
import { controlSurface, useField } from './field';

interface InputProps extends ComponentPropsWithRef<'input'> {
  readonly leading?: ReactNode;
  readonly trailing?: ReactNode;
}

export function Input({ className, leading, trailing, id, ...props }: InputProps) {
  const field = useField();
  const input = (
    <input
      id={id ?? field?.id}
      aria-describedby={field?.describedBy}
      aria-invalid={field?.invalid || undefined}
      aria-required={field?.required || undefined}
      className={cn(
        controlSurface,
        'h-11 px-3 type-body',
        leading ? 'pl-10' : undefined,
        trailing ? 'pr-10' : undefined,
        className,
      )}
      {...props}
    />
  );
  if (!leading && !trailing) return input;
  return (
    <div className="relative">
      {leading && (
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-faint [&_svg]:size-4">
          {leading}
        </span>
      )}
      {input}
      {trailing && (
        <span className="absolute inset-y-0 right-2 flex items-center text-ink-faint">
          {trailing}
        </span>
      )}
    </div>
  );
}

export function Textarea({ className, id, rows = 4, ...props }: ComponentPropsWithRef<'textarea'>) {
  const field = useField();
  return (
    <textarea
      id={id ?? field?.id}
      rows={rows}
      aria-describedby={field?.describedBy}
      aria-invalid={field?.invalid || undefined}
      aria-required={field?.required || undefined}
      className={cn(controlSurface, 'min-h-24 resize-y px-3 py-2.5 type-body', className)}
      {...props}
    />
  );
}
