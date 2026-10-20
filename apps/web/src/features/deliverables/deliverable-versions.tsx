import type { DeliverableVersion } from '@lintel/api-contracts';
import { cn } from '@lintel/design-system/web';
import { FileText } from 'lucide-react';
import { fileContentUrl, formatFileSize } from '@/features/tasks/detail/use-file-upload';
import { formatRelativeInstant } from '@/lib/format/dates';
import { DECISION_LABELS } from './use-deliverables';

const DECISION_TONE = {
  pending: 'text-review',
  approved: 'text-on-track',
  changes_requested: 'text-at-risk',
  rejected: 'text-overdue',
} as const;

/** Every submitted version, newest first, with its file and the reviewer's word. */
export function DeliverableVersions({
  versions,
}: {
  readonly versions: readonly DeliverableVersion[];
}) {
  if (versions.length === 0) {
    return (
      <p className="type-body-sm text-ink-faint">
        No versions yet. The first submission starts the review.
      </p>
    );
  }
  const ordered = [...versions].sort((left, right) => right.versionNumber - left.versionNumber);
  return (
    <ol className="flex flex-col gap-3">
      {ordered.map((version) => (
        <li key={version.id} className="flex gap-3">
          <span className="mt-0.5 w-8 shrink-0 font-mono text-[0.75rem] text-ink-faint">
            v{version.versionNumber}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            {version.file.isImage ? (
              <a
                href={fileContentUrl(version.file.id)}
                target="_blank"
                rel="noreferrer"
                className="block max-w-xs overflow-hidden rounded-md border border-hairline"
              >
                {/* biome-ignore lint/performance/noImgElement: private files come through the API proxy */}
                <img
                  src={fileContentUrl(version.file.id)}
                  alt={version.file.originalName}
                  loading="lazy"
                  className="aspect-[4/3] w-full object-cover"
                />
              </a>
            ) : (
              <a
                href={fileContentUrl(version.file.id)}
                className="inline-flex items-center gap-2 self-start rounded-sm type-body-sm text-ink hover:underline"
              >
                <FileText aria-hidden className="size-4 text-ink-faint" />
                {version.file.originalName}
                <span className="text-ink-faint">{formatFileSize(version.file.sizeBytes)}</span>
              </a>
            )}
            <p className="type-body-sm text-ink-muted">
              {version.submittedBy.fullName}, {formatRelativeInstant(version.submittedAt)}
              {version.note && <span className="text-ink-faint">: “{version.note}”</span>}
            </p>
            <p className={cn('type-body-sm font-medium', DECISION_TONE[version.decision])}>
              {DECISION_LABELS[version.decision]}
              {version.reviewedBy && (
                <span className="font-normal text-ink-muted">
                  {' '}
                  by {version.reviewedBy.fullName}
                </span>
              )}
            </p>
            {version.reviewComment && (
              <p className="type-body-sm text-ink">{version.reviewComment}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
