import type { ProjectDocument } from '@lintel/api-contracts';
import { DOCUMENT_FOLDER_LABELS } from '@lintel/domain';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { fileContentSource } from '@/api/file-transfer';
import { AppText } from '@/components/app-text';
import { Avatar } from '@/components/avatar';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { ScreenScroll } from '@/components/screen';
import { Divider, Section } from '@/components/section';
import { SkeletonList } from '@/components/skeleton';
import { ErrorState } from '@/components/state-views';
import { formatRelativeInstant } from '@/formatting/dates';
import { formatFileSize } from '@/formatting/quantities';
import { useDocument } from '@/queries/document-queries';
import { useAppTheme } from '@/theme/app-theme';
import { RADIUS, SPACE } from '@/theme/layout';
import { DocumentThumb, KIND_LABELS, showsAsPhoto } from './document-row';

function DetailRow({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <View style={styles.detail}>
      <AppText variant="bodySm" tone="secondary">
        {label}
      </AppText>
      <AppText variant="body" style={styles.flex} align="right" numberOfLines={2}>
        {value}
      </AppText>
    </View>
  );
}

function Preview({ document }: { readonly document: ProjectDocument }) {
  const { colors } = useAppTheme();
  if (showsAsPhoto(document)) {
    return (
      <Image
        source={fileContentSource(document.file.id)}
        style={[styles.photo, { backgroundColor: colors.surfaceSunken }]}
        contentFit="contain"
        transition={200}
        accessibilityLabel={document.title}
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <Card tone="sunken" style={styles.fileCard}>
      <DocumentThumb document={document} size={72} />
      <View style={styles.flex}>
        <AppText variant="titleMd" numberOfLines={2}>
          {document.file.originalName}
        </AppText>
        <AppText variant="bodySm" tone="secondary">
          {KIND_LABELS[document.kind]} · {formatFileSize(document.file.sizeBytes)}. This app shows
          photos; open drawings and documents from the project’s Documents tab on the web.
        </AppText>
      </View>
    </Card>
  );
}

/** One document, read-only: preview for photos, details for everything. */
export function DocumentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const document = useDocument(id);
  const { colors } = useAppTheme();
  const data = document.data;
  return (
    <>
      <Stack.Screen options={{ title: data ? DOCUMENT_FOLDER_LABELS[data.folder] : '' }} />
      <ScreenScroll edge="stack" onRefresh={() => document.refetch()}>
        {document.isPending ? <SkeletonList count={2} label="Loading the document" /> : null}
        {document.isError ? (
          <ErrorState
            error={document.error}
            subject="this document"
            onRetry={() => void document.refetch()}
          />
        ) : null}
        {data ? (
          <>
            <View style={styles.header}>
              <AppText variant="titleLg">{data.title}</AppText>
              {data.visibility === 'confidential' ? (
                <View style={styles.badge}>
                  <Icon name="lock" size={14} color={colors.textSecondary} />
                  <AppText variant="bodySm" tone="secondary">
                    Confidential: project managers only
                  </AppText>
                </View>
              ) : null}
              {data.archivedAt ? (
                <AppText variant="bodySm" tone="secondary">
                  Archived {formatRelativeInstant(data.archivedAt)}. The file is no longer
                  available.
                </AppText>
              ) : null}
            </View>
            {data.archivedAt ? null : <Preview document={data} />}
            <Section title="Details">
              <Card padded>
                <View style={styles.detail}>
                  <AppText variant="bodySm" tone="secondary">
                    Added by
                  </AppText>
                  <View style={styles.person}>
                    <Avatar user={data.addedBy} size={22} />
                    <AppText variant="body">{data.addedBy.fullName}</AppText>
                  </View>
                </View>
                <Divider />
                <DetailRow label="Added" value={formatRelativeInstant(data.createdAt)} />
                <Divider />
                <DetailRow label="Folder" value={DOCUMENT_FOLDER_LABELS[data.folder]} />
                <Divider />
                <DetailRow label="File" value={data.file.originalName} />
              </Card>
            </Section>
          </>
        ) : null}
      </ScreenScroll>
    </>
  );
}

const styles = StyleSheet.create({
  header: { gap: SPACE.sm },
  badge: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: RADIUS.lg },
  fileCard: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  detail: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACE.md,
    paddingVertical: SPACE.sm,
  },
  person: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  flex: { flex: 1 },
});
