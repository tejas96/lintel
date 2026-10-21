'use client';

import type { ProjectDocument } from '@lintel/api-contracts';
import {
  Button,
  EmptyState,
  ErrorState,
  Input,
  SegmentedControl,
  Skeleton,
  SkeletonGroup,
} from '@lintel/design-system/web';
import type { DocumentFolder } from '@lintel/domain';
import { Plus, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { describeError } from '@/lib/api/describe-error';
import { DocumentCard } from './document-card';
import { folderLabel } from './document-presentation';
import { DocumentPreviewSheet } from './document-preview-sheet';
import { FolderRail } from './folder-rail';
import { UploadDocumentSheet } from './upload-document-sheet';
import { type KindFilter, type LibraryFilters, useDocumentLibrary } from './use-documents';

const KIND_OPTIONS: readonly { value: KindFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'image', label: 'Images' },
  { value: 'pdf', label: 'PDFs' },
  { value: 'drawing', label: 'Drawings' },
  { value: 'office', label: 'Office' },
];

const GRID = 'grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4';

/** The project's document library: folders, search, a grid of previews, upload and archive. */
export function DocumentsTab({ projectId }: { readonly projectId: string }) {
  const [filters, setFilters] = useState<LibraryFilters>({
    folder: 'all',
    kind: 'all',
    search: '',
  });
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState<ProjectDocument | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => setFilters((current) => ({ ...current, search })), 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  const library = useDocumentLibrary(projectId, filters);
  const first = library.data?.pages[0];
  const items = library.data?.pages.flatMap((page) => page.items) ?? [];
  const filtered = filters.folder !== 'all' || filters.kind !== 'all' || filters.search !== '';
  const defaultFolder: DocumentFolder = filters.folder === 'all' ? 'other' : filters.folder;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl type-body-sm text-ink-muted">
          Drawings, contracts, mood boards and site photos for the whole project, in one place.
        </p>
        {first?.viewer.canUpload && (
          <Button
            variant="primary"
            leadingIcon={<Plus aria-hidden />}
            onClick={() => setUploading(true)}
            className="self-start"
          >
            Add a document
          </Button>
        )}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-8">
        <FolderRail
          value={filters.folder}
          onValueChange={(folder) => setFilters((current) => ({ ...current, folder }))}
          counts={first?.folderCounts}
        />
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="min-w-0 flex-1 lg:max-w-sm">
              <Input
                type="search"
                aria-label="Search documents by title or file name"
                placeholder="Search titles and file names"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                leading={<Search aria-hidden />}
              />
            </div>
            <SegmentedControl
              label="Kind of file"
              size="sm"
              value={filters.kind}
              onValueChange={(kind) => setFilters((current) => ({ ...current, kind }))}
              options={KIND_OPTIONS}
              className="self-start overflow-x-auto"
            />
          </div>
          {library.isPending && (
            <SkeletonGroup label="Loading documents" className={GRID}>
              {[0, 1, 2, 3, 4, 5].map((card) => (
                <Skeleton key={card} className="aspect-[4/5] rounded-lg" />
              ))}
            </SkeletonGroup>
          )}
          {library.isError && (
            <ErrorState
              {...describeError(library.error, { resource: 'collection' })}
              onRetry={() => library.refetch()}
            />
          )}
          {library.data && items.length === 0 && !filtered && (
            <EmptyState
              drawing="drafting"
              title="No documents yet"
              description="Keep the drawing set, signed contracts, mood boards and site photos here, so the whole team works from the same files."
              actions={
                first?.viewer.canUpload ? (
                  <Button
                    variant="secondary"
                    leadingIcon={<Plus aria-hidden />}
                    onClick={() => setUploading(true)}
                  >
                    Add the first document
                  </Button>
                ) : undefined
              }
            />
          )}
          {library.data && items.length === 0 && filtered && (
            <EmptyState
              drawing="plan"
              title={
                filters.search
                  ? `Nothing matches “${filters.search}”`
                  : `Nothing in ${folderLabel(filters.folder)}`
              }
              description="Try another folder or kind, or clear the search."
              actions={
                <Button
                  variant="quiet"
                  onClick={() => {
                    setSearch('');
                    setFilters({ folder: 'all', kind: 'all', search: '' });
                  }}
                >
                  Show every document
                </Button>
              }
            />
          )}
          {items.length > 0 && (
            <>
              <p className="sr-only" aria-live="polite">
                {first?.totalItems} {first?.totalItems === 1 ? 'document' : 'documents'} shown.
              </p>
              <ul className={GRID}>
                {items.map((document, index) => (
                  <DocumentCard
                    key={document.id}
                    document={document}
                    index={index}
                    onOpen={setOpen}
                  />
                ))}
              </ul>
              {library.hasNextPage && (
                <Button
                  variant="secondary"
                  className="self-center"
                  pending={library.isFetchingNextPage}
                  onClick={() => library.fetchNextPage()}
                >
                  Show more documents
                </Button>
              )}
            </>
          )}
        </div>
      </div>
      <UploadDocumentSheet
        projectId={projectId}
        open={uploading}
        onOpenChange={setUploading}
        canUploadConfidential={first?.viewer.canUploadConfidential ?? false}
        defaultFolder={defaultFolder}
      />
      <DocumentPreviewSheet projectId={projectId} document={open} onClose={() => setOpen(null)} />
    </div>
  );
}
