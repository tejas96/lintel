'use client';

import { cn, useField } from '@lintel/design-system/web';
import { FileUp } from 'lucide-react';
import { type DragEvent, useRef, useState } from 'react';
import { formatFileSize } from '@/features/tasks/detail/use-file-upload';

const ACCEPT = '.jpg,.jpeg,.png,.webp,.heic,.pdf,.dwg,.docx,.xlsx,.pptx,image/*,application/pdf';

/**
 * One file, chosen with the picker or dropped. Lives inside a Field, so the
 * field's label names it and its hint and error describe it.
 */
export function FileDropZone({
  file,
  onFile,
}: {
  readonly file: File | null;
  readonly onFile: (file: File) => void;
}) {
  const field = useField();
  const picker = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const onDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files[0];
    if (dropped) onFile(dropped);
  };
  return (
    <>
      <input
        ref={picker}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const chosen = event.target.files?.[0];
          event.target.value = '';
          if (chosen) onFile(chosen);
        }}
      />
      <button
        id={field?.id}
        type="button"
        aria-describedby={field?.describedBy}
        aria-invalid={field?.invalid || undefined}
        onClick={() => picker.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex min-h-32 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center',
          'transition-colors duration-(--duration-fast) aria-invalid:border-overdue',
          dragging
            ? 'border-accent bg-accent-soft/50'
            : 'border-rule bg-sunken/50 hover:border-ink-faint',
        )}
      >
        <FileUp aria-hidden className="size-6 text-ink-faint" />
        {file ? (
          <span className="flex flex-col gap-0.5">
            <span className="break-all type-body-sm font-medium text-ink">{file.name}</span>
            <span className="type-body-sm text-ink-faint">
              {formatFileSize(file.size)} · choose another file
            </span>
          </span>
        ) : (
          <span className="flex flex-col gap-0.5">
            <span className="type-body-sm font-medium text-ink">Choose a file or drop it here</span>
            <span className="type-body-sm text-ink-faint">
              Photos (JPEG, PNG, WebP, HEIC), PDF, DWG drawings, Word, Excel or PowerPoint
            </span>
          </span>
        )}
      </button>
    </>
  );
}
