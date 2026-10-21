import { cn } from '@lintel/design-system/web';
import { Ban, Minus, PencilLine, Plus } from 'lucide-react';

export type ChangeKind = 'added' | 'changed' | 'removed' | 'unchanged';

const MARKS: Readonly<Record<ChangeKind, { label: string; className: string; Icon: typeof Plus }>> =
  {
    added: { label: 'Added', className: 'bg-on-track-tint text-on-track', Icon: Plus },
    changed: { label: 'Changed', className: 'bg-review-tint text-review', Icon: PencilLine },
    removed: { label: 'Removed', className: 'bg-overdue-tint text-overdue', Icon: Minus },
    unchanged: { label: 'Will not change', className: 'bg-sunken text-ink-muted', Icon: Ban },
  };

/**
 * The diff vocabulary of a template update: colour, glyph and word together,
 * like every status in Lintel. `compact` keeps the word for screen readers only.
 */
export function ChangeMark({
  kind,
  compact = false,
  className,
}: {
  readonly kind: ChangeKind;
  readonly compact?: boolean;
  readonly className?: string;
}) {
  const mark = MARKS[kind];
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1 rounded-sm px-1.5 text-[0.75rem] font-medium',
        mark.className,
        className,
      )}
    >
      <mark.Icon aria-hidden className="size-3.5" strokeWidth={2.25} />
      <span className={cn(compact && 'sr-only')}>{mark.label}</span>
    </span>
  );
}

export const CHANGE_HEADINGS: Readonly<Record<ChangeKind, { title: string; description: string }>> =
  {
    added: {
      title: 'Added',
      description:
        'New stages, milestones and tasks, scheduled from today and given to whoever holds the role.',
    },
    changed: {
      title: 'Changed',
      description:
        'Updates to work that has not started. Started work and committed dates change only if you tick them.',
    },
    removed: {
      title: 'Removed',
      description: 'Unstarted tasks are cancelled, never deleted, so their history stays.',
    },
    unchanged: {
      title: 'Will not change',
      description:
        'Finished work, closed stages and anything waiting for review stay exactly as recorded.',
    },
  };
