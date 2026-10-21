'use client';

import type { DocumentLibrary } from '@lintel/api-contracts';
import { cn, Select } from '@lintel/design-system/web';
import { DOCUMENT_FOLDERS, type DocumentFolder } from '@lintel/domain';
import { FOLDER_ICONS, folderLabel } from './document-presentation';

type FolderChoice = DocumentFolder | 'all';
const CHOICES: readonly FolderChoice[] = ['all', ...DOCUMENT_FOLDERS];

/**
 * Folders with their counts: a quiet list beside the library on wide
 * screens, a single choice above it on phones. Counts follow the search.
 */
export function FolderRail({
  value,
  onValueChange,
  counts,
}: {
  readonly value: FolderChoice;
  readonly onValueChange: (folder: FolderChoice) => void;
  readonly counts: DocumentLibrary['folderCounts'] | undefined;
}) {
  return (
    <>
      <nav aria-label="Folders" className="hidden md:sticky md:top-6 md:block md:self-start">
        <ul className="flex flex-col gap-0.5">
          {CHOICES.map((folder) => {
            const Icon = FOLDER_ICONS[folder];
            const selected = folder === value;
            return (
              <li key={folder}>
                <button
                  type="button"
                  aria-current={selected ? 'true' : undefined}
                  onClick={() => onValueChange(folder)}
                  className={cn(
                    'flex min-h-10 w-full items-center gap-3 rounded-md px-3 text-left type-body-sm transition-colors duration-(--duration-fast)',
                    selected
                      ? 'bg-raised font-medium text-ink shadow-e1 ring-1 ring-hairline'
                      : 'text-ink-muted hover:bg-sunken hover:text-ink',
                  )}
                >
                  <Icon
                    aria-hidden
                    className={cn('size-4 shrink-0', selected ? 'text-accent' : 'text-ink-faint')}
                  />
                  <span className="min-w-0 flex-1 truncate">{folderLabel(folder)}</span>
                  <span className="font-mono text-[0.75rem] text-ink-faint tabular-nums">
                    {counts ? counts[folder] : ''}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="md:hidden">
        <Select
          label="Folder"
          value={value}
          onValueChange={onValueChange}
          options={CHOICES.map((folder) => {
            const Icon = FOLDER_ICONS[folder];
            return {
              value: folder,
              label: counts ? `${folderLabel(folder)} (${counts[folder]})` : folderLabel(folder),
              icon: <Icon aria-hidden />,
            };
          })}
        />
      </div>
    </>
  );
}
