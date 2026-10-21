import type { ProjectDocument } from '@lintel/api-contracts';
import { cn } from '@lintel/design-system/web';
import { DOCUMENT_FOLDER_LABELS, type DocumentFolder } from '@lintel/domain';
import {
  Camera,
  DraftingCompass,
  FileImage,
  FileSignature,
  FileSpreadsheet,
  FileText,
  Folder,
  Layers,
  type LucideIcon,
  Palette,
  Presentation,
} from 'lucide-react';
import { fileContentUrl } from '@/features/tasks/detail/use-file-upload';

type Kind = ProjectDocument['kind'];

export const KIND_LABELS: Readonly<Record<Kind, string>> = {
  image: 'Image',
  pdf: 'PDF',
  drawing: 'DWG drawing',
  spreadsheet: 'Spreadsheet',
  presentation: 'Presentation',
  text: 'Document',
};

const KIND_ICONS: Readonly<Record<Kind, LucideIcon>> = {
  image: FileImage,
  pdf: FileText,
  drawing: DraftingCompass,
  spreadsheet: FileSpreadsheet,
  presentation: Presentation,
  text: FileText,
};

export const FOLDER_ICONS: Readonly<Record<DocumentFolder | 'all', LucideIcon>> = {
  all: Layers,
  drawings: DraftingCompass,
  contracts: FileSignature,
  mood_boards: Palette,
  site_photos: Camera,
  other: Folder,
};

export function folderLabel(folder: DocumentFolder | 'all'): string {
  return folder === 'all' ? 'All documents' : DOCUMENT_FOLDER_LABELS[folder];
}

/** Browsers show JPEG, PNG and WebP; HEIC photos download instead. */
export function canPreviewInline(document: ProjectDocument): boolean {
  return document.kind === 'image' && document.file.contentType !== 'image/heic';
}

/** "PDF", "DWG", "XLSX": the file's extension, as printed on a drawing's title block. */
export function extensionOf(document: ProjectDocument): string {
  const extension = document.file.originalName.split('.').pop() ?? '';
  return extension.length > 0 && extension.length <= 5 ? extension.toUpperCase() : 'FILE';
}

/**
 * The preview area of a document: the photo itself, or a quiet paper tile
 * with the kind's icon and the extension set like a title-block label.
 */
export function DocumentThumbnail({
  document,
  className,
}: {
  readonly document: ProjectDocument;
  readonly className?: string;
}) {
  if (canPreviewInline(document)) {
    return (
      // biome-ignore lint/performance/noImgElement: private files come through the API proxy, not next/image
      <img
        src={fileContentUrl(document.file.id)}
        alt=""
        loading="lazy"
        className={cn('size-full bg-sunken object-cover', className)}
      />
    );
  }
  const Icon = KIND_ICONS[document.kind];
  return (
    <span
      aria-hidden
      className={cn(
        'relative flex size-full items-center justify-center bg-sunken text-ink-faint',
        className,
      )}
    >
      <Icon className="size-9 stroke-[1.25]" />
      <span className="absolute right-2 bottom-2 rounded-sm border border-rule bg-raised px-1.5 py-0.5 font-mono text-[0.6875rem] tracking-wide text-ink-muted">
        {extensionOf(document)}
      </span>
    </span>
  );
}
