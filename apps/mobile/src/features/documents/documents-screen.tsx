import { DOCUMENT_FOLDER_LABELS, DOCUMENT_FOLDERS, type DocumentFolder } from '@lintel/domain';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/button';
import { ChoiceChips } from '@/components/choice-chips';
import { ScreenScroll } from '@/components/screen';
import { SkeletonList } from '@/components/skeleton';
import { EmptyState, ErrorState } from '@/components/state-views';
import { useProjectDocuments } from '@/queries/document-queries';
import { SPACE } from '@/theme/layout';
import { DocumentRow } from './document-row';

type FolderChoice = DocumentFolder | 'all';

const FOLDER_OPTIONS: readonly { value: FolderChoice; label: string }[] = [
  { value: 'all', label: 'All' },
  ...DOCUMENT_FOLDERS.map((folder) => ({ value: folder, label: DOCUMENT_FOLDER_LABELS[folder] })),
];

/** The whole library of one project, read-only, filtered by folder. */
export function DocumentsScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const [folder, setFolder] = useState<FolderChoice>('all');
  const documents = useProjectDocuments(projectId, folder);
  const items = documents.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <ScreenScroll edge="stack" onRefresh={() => documents.refetch()}>
      <ChoiceChips
        options={FOLDER_OPTIONS}
        value={folder}
        onChange={setFolder}
        accessibilityLabel="Folder"
      />
      {documents.isPending ? <SkeletonList count={4} label="Loading documents" /> : null}
      {documents.isError ? (
        <ErrorState
          error={documents.error}
          subject="these documents"
          onRetry={() => void documents.refetch()}
        />
      ) : null}
      {documents.isSuccess && items.length === 0 ? (
        <EmptyState
          icon="document"
          title={
            folder === 'all'
              ? 'No documents yet'
              : `Nothing in ${FOLDER_OPTIONS.find((option) => option.value === folder)?.label}`
          }
          message="Documents added on the web appear here: drawings, contracts, mood boards and site photos."
        />
      ) : null}
      <View style={{ gap: SPACE.md }}>
        {items.map((document) => (
          <DocumentRow key={document.id} document={document} />
        ))}
      </View>
      {documents.hasNextPage ? (
        <Button
          label="Show more"
          variant="secondary"
          loading={documents.isFetchingNextPage}
          onPress={() => void documents.fetchNextPage()}
        />
      ) : null}
    </ScreenScroll>
  );
}
