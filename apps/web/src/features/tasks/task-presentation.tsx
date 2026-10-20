import type { ProjectRef } from '@lintel/api-contracts';
import { cn, type PillTone, type StatusGlyphName, StatusPill } from '@lintel/design-system/web';
import type { TaskStatus } from '@lintel/domain';

export const TASK_STATUS_PRESENTATION: Readonly<
  Record<
    TaskStatus,
    { readonly tone: PillTone; readonly glyph: StatusGlyphName; readonly label: string }
  >
> = {
  draft: { tone: 'neutral', glyph: 'draft', label: 'Draft' },
  ready: { tone: 'neutral', glyph: 'ready', label: 'Ready' },
  in_progress: { tone: 'neutral', glyph: 'progress', label: 'In progress' },
  blocked: { tone: 'blocked', glyph: 'blocked', label: 'Blocked' },
  in_review: { tone: 'review', glyph: 'review', label: 'In review' },
  changes_requested: { tone: 'atRisk', glyph: 'changes', label: 'Changes requested' },
  done: { tone: 'done', glyph: 'done', label: 'Done' },
  cancelled: { tone: 'neutral', glyph: 'cancelled', label: 'Cancelled' },
};

export function TaskStatusPill({
  status,
  size = 'sm',
}: {
  readonly status: TaskStatus;
  readonly size?: 'sm' | 'md';
}) {
  const presentation = TASK_STATUS_PRESENTATION[status];
  return (
    <StatusPill
      tone={presentation.tone}
      glyph={presentation.glyph}
      label={presentation.label}
      size={size}
    />
  );
}

/** Static class names so Tailwind can see them. */
export const SWATCH_BACKGROUNDS = [
  'bg-swatch-0',
  'bg-swatch-1',
  'bg-swatch-2',
  'bg-swatch-3',
  'bg-swatch-4',
  'bg-swatch-5',
] as const;

export function swatchClass(colorIndex: number): string {
  return SWATCH_BACKGROUNDS[Math.abs(colorIndex) % SWATCH_BACKGROUNDS.length] ?? 'bg-swatch-0';
}

/** A project's identity: its colour square, reference and (optionally) name. */
export function ProjectChip({
  project,
  showName = true,
  className,
}: {
  readonly project: ProjectRef;
  readonly showName?: boolean;
  readonly className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex min-w-0 items-center gap-1.5 type-body-sm text-ink-muted',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn('size-2 shrink-0 rounded-[2px]', swatchClass(project.colorIndex))}
      />
      <span className="shrink-0 font-mono text-[0.75rem] text-ink-faint">{project.reference}</span>
      {showName && <span className="truncate">{project.name}</span>}
    </span>
  );
}

/** "#142" in the mono face. */
export function TaskNumber({
  value,
  className,
}: {
  readonly value: number;
  readonly className?: string;
}) {
  return <span className={cn('font-mono text-[0.75rem] text-ink-faint', className)}>#{value}</span>;
}
