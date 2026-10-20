import type { ReactNode } from 'react';

/** A titled block inside task detail. Headings are real h2s for navigation. */
export function DetailSection({
  title,
  meta,
  action,
  children,
}: {
  readonly title: string;
  /** Short context next to the title, e.g. "3 of 5". */
  readonly meta?: ReactNode;
  readonly action?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <header className="flex min-h-9 items-center justify-between gap-3">
        <h2 className="flex items-baseline gap-2 type-title-md text-ink">
          {title}
          {meta && <span className="type-body-sm font-normal text-ink-faint">{meta}</span>}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}
