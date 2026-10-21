'use client';

import type { ProjectDocument } from '@lintel/api-contracts';
import { Badge, listItemEnter } from '@lintel/design-system/web';
import { LockKeyhole } from 'lucide-react';
import { motion } from 'motion/react';
import { formatFileSize } from '@/features/tasks/detail/use-file-upload';
import { formatRelativeInstant } from '@/lib/format/dates';
import { DocumentThumbnail, folderLabel, KIND_LABELS } from './document-presentation';

/** One document in the library grid: preview, title, who added it and when. Opens the preview. */
export function DocumentCard({
  document,
  index,
  onOpen,
}: {
  readonly document: ProjectDocument;
  readonly index: number;
  readonly onOpen: (document: ProjectDocument) => void;
}) {
  return (
    <motion.li {...listItemEnter(index)} className="min-w-0">
      <button
        type="button"
        onClick={() => onOpen(document)}
        className="group flex h-full w-full flex-col overflow-hidden rounded-lg border border-hairline bg-raised text-left transition-[box-shadow,border-color] duration-(--duration-fast) hover:border-rule hover:shadow-e2"
      >
        <span className="relative block aspect-[4/3] overflow-hidden border-b border-hairline">
          <DocumentThumbnail
            document={document}
            className="transition-transform duration-(--duration-slow) group-hover:scale-[1.02]"
          />
          {document.visibility === 'confidential' && (
            <Badge variant="soft" className="absolute top-2 left-2 bg-raised/95 shadow-e1">
              <LockKeyhole aria-hidden className="size-3" />
              Confidential
            </Badge>
          )}
        </span>
        <span className="flex min-w-0 flex-col gap-1 p-3">
          <span className="line-clamp-2 type-body-sm font-medium text-ink">{document.title}</span>
          <span className="truncate type-body-sm text-ink-faint">
            {KIND_LABELS[document.kind]} · {formatFileSize(document.file.sizeBytes)}
          </span>
          <span className="truncate type-body-sm text-ink-faint">
            {document.addedBy.fullName}, {formatRelativeInstant(document.createdAt)}
          </span>
          <span className="sr-only">Filed in {folderLabel(document.folder)}.</span>
        </span>
      </button>
    </motion.li>
  );
}
