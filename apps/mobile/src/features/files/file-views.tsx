import type { FileSummary } from '@lintel/api-contracts';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { fileContentSource } from '@/api/file-transfer';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { ProgressBar } from '@/components/progress-bar';
import { formatFileSize } from '@/formatting/quantities';
import { useAppTheme } from '@/theme/app-theme';
import { RADIUS, SPACE } from '@/theme/layout';
import type { UploadItem } from './use-uploads';

/** A stored file: images show a thumbnail (fetched with the session), others an icon. */
export function FileTile({
  file,
  size = 72,
}: {
  readonly file: FileSummary;
  readonly size?: number;
}) {
  const { colors } = useAppTheme();
  return (
    <View
      style={styles.tile}
      accessible
      accessibilityLabel={`${file.originalName}, ${formatFileSize(file.sizeBytes)}`}
    >
      {file.isImage ? (
        <Image
          source={fileContentSource(file.id)}
          style={[
            styles.thumb,
            { width: size, height: size, backgroundColor: colors.surfaceSunken },
          ]}
          contentFit="cover"
          transition={160}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View
          style={[
            styles.thumb,
            styles.docThumb,
            { width: size, height: size, backgroundColor: colors.surfaceSunken },
          ]}
        >
          <Icon name="document" size={24} color={colors.textSecondary} />
        </View>
      )}
      <View style={styles.meta}>
        <AppText variant="bodySm" numberOfLines={2}>
          {file.originalName}
        </AppText>
        <AppText variant="mono" tone="tertiary">
          {formatFileSize(file.sizeBytes)} · {file.uploadedBy.fullName}
        </AppText>
      </View>
    </View>
  );
}

/** Uploads in flight: a progress bar each, with retry when one fails. */
export function UploadList({
  items,
  onRetry,
  onRemove,
}: {
  readonly items: readonly UploadItem[];
  readonly onRetry: (key: string) => void;
  readonly onRemove?: (key: string) => void;
}) {
  const { status } = useAppTheme();
  if (items.length === 0) return null;
  return (
    <View style={styles.uploads}>
      {items.map((item) => (
        <View key={item.key} style={styles.upload}>
          <View style={styles.uploadHeader}>
            <AppText variant="bodySm" numberOfLines={1} style={styles.flex}>
              {item.file.name}
            </AppText>
            <AppText variant="mono" tone="tertiary">
              {item.status === 'done'
                ? 'Uploaded'
                : item.status === 'failed'
                  ? 'Failed'
                  : `${Math.round(item.progress * 100)}%`}
            </AppText>
          </View>
          <ProgressBar
            value={item.progress}
            height={4}
            color={
              item.status === 'failed'
                ? status.overdue.solid
                : item.status === 'done'
                  ? status.onTrack.solid
                  : undefined
            }
            accessibilityLabel={`Uploading ${item.file.name}`}
          />
          {item.status === 'failed' ? (
            <View style={styles.uploadHeader}>
              <AppText variant="bodySm" color={status.overdue.fg} style={styles.flex}>
                {item.error}
              </AppText>
              <Button label="Retry" variant="quiet" onPress={() => onRetry(item.key)} />
              {onRemove ? (
                <Button label="Remove" variant="quiet" onPress={() => onRemove(item.key)} />
              ) : null}
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { flexDirection: 'row', gap: SPACE.md, alignItems: 'center' },
  thumb: { borderRadius: RADIUS.md },
  docThumb: { alignItems: 'center', justifyContent: 'center' },
  meta: { flex: 1, gap: 2 },
  uploads: { gap: SPACE.md },
  upload: { gap: SPACE.xs },
  uploadHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  flex: { flex: 1 },
});
