import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cn } from '../lib/cn';

interface CardProps extends ComponentPropsWithRef<'section'> {
  /** `raised` lifts the card with a shadow (use for the one card that matters most). */
  readonly tone?: 'paper' | 'raised' | 'sunken';
}

/** A sheet of paper: hairline edge, no shadow unless it is the focus. */
export function Card({ tone = 'paper', className, ...props }: CardProps) {
  return (
    <section
      className={cn(
        'rounded-lg border',
        tone === 'paper' && 'border-hairline bg-raised',
        tone === 'raised' && 'border-hairline bg-raised shadow-e2',
        tone === 'sunken' && 'border-transparent bg-sunken/70',
        className,
      )}
      {...props}
    />
  );
}

interface CardHeaderProps {
  readonly title: ReactNode;
  readonly description?: ReactNode;
  /** Right-aligned control (a link, a count, a button). */
  readonly action?: ReactNode;
  readonly headingLevel?: 2 | 3;
  readonly className?: string;
  readonly id?: string;
}

export function CardHeader({
  title,
  description,
  action,
  headingLevel = 2,
  className,
  id,
}: CardHeaderProps) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <header className={cn('flex items-start justify-between gap-4 px-5 pt-4 pb-3', className)}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <Heading id={id} className="type-title-md text-ink">
          {title}
        </Heading>
        {description && <p className="type-body-sm text-ink-faint">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </header>
  );
}

/** Page heading: serif title, optional supporting line and actions. */
export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  className,
}: {
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly actions?: ReactNode;
  /** Context above the title, e.g. a breadcrumb link. Not decoration. */
  readonly eyebrow?: ReactNode;
  readonly className?: string;
}) {
  return (
    <header
      className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}
    >
      <div className="flex min-w-0 flex-col gap-2">
        {eyebrow && <div className="type-body-sm text-ink-muted">{eyebrow}</div>}
        <h1 className="type-display-md text-balance text-ink md:type-display-lg">{title}</h1>
        {description && <p className="max-w-2xl type-body text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
