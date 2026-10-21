import type { ProjectDocument } from '@lintel/api-contracts';
import { DOCUMENT_FOLDER_LABELS } from '@lintel/domain';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { fileContentSource } from '@/api/file-transfer';
import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { formatFileSize } from '@/formatting/quantities';
import { useAppTheme } from '@/theme/app-theme';
import { RADIUS, SPACE } from '@/theme/layout';

export const KIND_LABELS: Readonly<Record<ProjectDocument['kind'], string>> = {
  image: 'Image',
  pdf: 'PDF',
  drawing: 'DWG drawing',
  spreadsheet: 'Spreadsheet',
  presentation: 'Presentation',
  text: 'Document',
};

/** Photos the app can draw itself (HEIC and drawings are shown as a file). */
export function showsAsPhoto(document: ProjectDocument): boolean {
  return document.kind === 'image';
}

/** A photo thumbnail fetched with the session, or a document tile. */
export function DocumentThumb({
  document,
  size,
}: {
  readonly document: ProjectDocument;
  readonly size: number;
}) {
  const { colors } = useAppTheme();
  const frame = { width: size, height: size, backgroundColor: colors.surfaceSunken };
  if (showsAsPhoto(document)) {
    return (
      <Image
        source={fileContentSource(document.file.id)}
        style={[styles.thumb, frame]}
        contentFit="cover"
        transition={160}
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <View style={[styles.thumb, styles.tile, frame]}>
      <Icon name="document" size={Math.round(size / 2.6)} color={colors.textSecondary} />
    </View>
  );
}

/** One document in a list; opens the document screen. */
export function DocumentRow({ document }: { readonly document: ProjectDocument }) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const confidential = document.visibility === 'confidential';
  const meta = `${DOCUMENT_FOLDER_LABELS[document.folder]} · ${KIND_LABELS[document.kind]} · ${formatFileSize(document.file.sizeBytes)}`;
  return (
    <Card
      onPress={() => router.push({ pathname: '/documents/[id]', params: { id: document.id } })}
      accessibilityLabel={`${document.title}${confidential ? ', confidential' : ''}. ${meta}`}
      accessibilityHint="Opens the document"
      style={styles.row}
    >
      <DocumentThumb document={document} size={56} />
      <View style={styles.text}>
        <AppText variant="titleMd" numberOfLines={2}>
          {document.title}
        </AppText>
        <View style={styles.meta}>
          {confidential ? <Icon name="lock" size={12} color={colors.textSecondary} /> : null}
          <AppText variant="bodySm" tone="secondary" numberOfLines={1} style={styles.flex}>
            {meta}
          </AppText>
        </View>
      </View>
      <Icon name="chevronRight" size={14} color={colors.textTertiary} />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  thumb: { borderRadius: RADIUS.md },
  tile: { alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: SPACE.xs },
  meta: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  flex: { flex: 1 },
});
