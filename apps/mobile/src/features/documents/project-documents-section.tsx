import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { isNotFound } from '@/api/api-error';
import { ListRow } from '@/components/list-row';
import { Section } from '@/components/section';
import { useProjectDocuments } from '@/queries/document-queries';
import { SPACE } from '@/theme/layout';
import { DocumentRow } from './document-row';

const PREVIEW_COUNT = 4;

/** The newest documents on the project screen, with a way into the whole library. */
export function ProjectDocumentsSection({ projectId }: { readonly projectId: string }) {
  const router = useRouter();
  const documents = useProjectDocuments(projectId, 'all');
  if (documents.isError && isNotFound(documents.error)) return null;
  const first = documents.data?.pages[0];
  if (!first || first.totalItems === 0) return null;
  return (
    <Section title="Documents" meta={String(first.totalItems)}>
      <View style={{ gap: SPACE.md }}>
        {first.items.slice(0, PREVIEW_COUNT).map((document) => (
          <DocumentRow key={document.id} document={document} />
        ))}
        {first.totalItems > PREVIEW_COUNT ? (
          <ListRow
            title={`All ${first.totalItems} documents`}
            subtitle="Drawings, contracts, mood boards and site photos"
            icon="document"
            onPress={() =>
              router.push({ pathname: '/project-documents/[projectId]', params: { projectId } })
            }
          />
        ) : null}
      </View>
    </Section>
  );
}
