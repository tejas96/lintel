'use client';

import type { TemplateDetail } from '@lintel/api-contracts';
import { type PillTone, Sheet, type StatusGlyphName, StatusPill } from '@lintel/design-system/web';
import { formatRelativeInstant } from '@/lib/format/dates';

const STATUS: Readonly<
  Record<
    'draft' | 'published' | 'retired',
    { tone: PillTone; glyph: StatusGlyphName; label: string }
  >
> = {
  draft: { tone: 'review', glyph: 'draft', label: 'Draft' },
  published: { tone: 'onTrack', glyph: 'onTrack', label: 'In use for new projects' },
  retired: { tone: 'neutral', glyph: 'done', label: 'Replaced' },
};

interface VersionHistoryProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly detail: TemplateDetail;
}

/** Every version, newest first: when it was published, what changed, and how many projects use it. */
export function VersionHistory({ open, onOpenChange, detail }: VersionHistoryProps) {
  const versions = [...detail.versions].sort(
    (left, right) => right.versionNumber - left.versionNumber,
  );
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Version history"
      description={detail.name}
    >
      <ol className="flex flex-col p-5 sm:p-6">
        {versions.map((version, index) => {
          const status = STATUS[version.status];
          const stages = version.definition.stages.length;
          const tasks = version.definition.stages.reduce(
            (total, stage) => total + stage.tasks.length,
            0,
          );
          return (
            <li key={version.id} className="relative flex gap-4 pb-7 last:pb-0">
              {index < versions.length - 1 && (
                <span
                  aria-hidden
                  className="absolute top-9 bottom-0 left-[1.1875rem] w-px bg-hairline"
                />
              )}
              <span className="relative z-[1] flex size-10 shrink-0 items-center justify-center rounded-full border border-hairline bg-raised font-display text-[1.0625rem] text-ink tabular-nums">
                {version.versionNumber}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill
                    tone={status.tone}
                    glyph={status.glyph}
                    label={status.label}
                    size="sm"
                  />
                  {version.publishedAt && (
                    <span className="type-body-sm text-ink-faint">
                      Published {formatRelativeInstant(version.publishedAt)}
                    </span>
                  )}
                </div>
                <p className="type-body-sm text-ink-muted">
                  {stages} {stages === 1 ? 'stage' : 'stages'}, {tasks}{' '}
                  {tasks === 1 ? 'task' : 'tasks'}
                  {version.status !== 'draft' &&
                    `, ${version.projectCount === 0 ? 'no projects' : version.projectCount === 1 ? '1 project' : `${version.projectCount} projects`}`}
                </p>
                {version.changeNotes && <p className="type-body text-ink">{version.changeNotes}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </Sheet>
  );
}
