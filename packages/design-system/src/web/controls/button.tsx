'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { LoaderCircle } from 'lucide-react';
import { Slot } from 'radix-ui';
import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cn } from '../lib/cn';

export const buttonStyles = cva(
  [
    'relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md',
    'font-sans font-medium select-none transition-[background-color,color,border-color,box-shadow,transform,opacity]',
    'duration-(--duration-fast) ease-standard active:scale-[0.98]',
    'disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50',
  ],
  {
    variants: {
      variant: {
        primary:
          'bg-accent text-on-accent shadow-e1 hover:bg-accent-hover active:bg-accent-pressed',
        secondary:
          'border border-rule bg-raised text-ink shadow-e1 hover:border-ink-faint hover:bg-surface',
        quiet: 'text-ink-muted hover:bg-sunken hover:text-ink',
        danger: 'border border-overdue/40 bg-raised text-overdue shadow-e1 hover:bg-overdue-tint',
        blueprint: 'bg-on-blueprint text-blueprint shadow-e2 hover:bg-on-blueprint/90',
        blueprintQuiet:
          'border border-on-blueprint/30 text-on-blueprint hover:border-on-blueprint/60 hover:bg-on-blueprint/10',
      },
      size: {
        sm: 'h-9 px-3 text-[0.8125rem] pointer-coarse:h-11',
        md: 'h-11 px-4 text-[0.9375rem]',
        lg: 'h-12 px-5 text-base',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);

export interface ButtonProps
  extends ComponentPropsWithRef<'button'>,
    VariantProps<typeof buttonStyles> {
  /** Shows a spinner, keeps the width and blocks repeat presses. */
  readonly pending?: boolean;
  readonly leadingIcon?: ReactNode;
  readonly trailingIcon?: ReactNode;
  /** Render the child element (for example a link) with button styles. */
  readonly asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  pending = false,
  leadingIcon,
  trailingIcon,
  asChild = false,
  disabled,
  children,
  type,
  ...props
}: ButtonProps) {
  const classes = cn(buttonStyles({ variant, size }), className);
  if (asChild) {
    return (
      <Slot.Root className={classes} {...props}>
        {children}
      </Slot.Root>
    );
  }
  return (
    <button
      type={type ?? 'button'}
      className={classes}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...props}
    >
      {pending ? (
        <LoaderCircle aria-hidden className="size-4 animate-spin" />
      ) : (
        leadingIcon && (
          <span className="-ml-0.5 inline-flex shrink-0 [&_svg]:size-4">{leadingIcon}</span>
        )
      )}
      {children}
      {trailingIcon && !pending && (
        <span className="-mr-0.5 inline-flex shrink-0 [&_svg]:size-4">{trailingIcon}</span>
      )}
    </button>
  );
}

const iconButtonStyles = cva(
  [
    'relative inline-flex shrink-0 items-center justify-center rounded-md transition-[background-color,color,transform]',
    'duration-(--duration-fast) ease-standard active:scale-95 disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:size-[1.125rem]',
  ],
  {
    variants: {
      variant: {
        quiet: 'text-ink-muted hover:bg-sunken hover:text-ink',
        secondary: 'border border-rule bg-raised text-ink shadow-e1 hover:bg-surface',
        blueprint: 'text-on-blueprint-muted hover:bg-on-blueprint/10 hover:text-on-blueprint',
      },
      size: { sm: 'size-9 pointer-coarse:size-11', md: 'size-11' },
    },
    defaultVariants: { variant: 'quiet', size: 'md' },
  },
);

export interface IconButtonProps
  extends Omit<ComponentPropsWithRef<'button'>, 'aria-label'>,
    VariantProps<typeof iconButtonStyles> {
  /** Required: icon-only controls must say what they do. */
  readonly label: string;
}

export function IconButton({ label, className, variant, size, type, ...props }: IconButtonProps) {
  return (
    <button
      type={type ?? 'button'}
      aria-label={label}
      title={label}
      className={cn(iconButtonStyles({ variant, size }), className)}
      {...props}
    />
  );
}
