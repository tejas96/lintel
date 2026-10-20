import { Image } from 'expo-image';
import { ScrollView, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/icon-button';
import { ProgressBar } from '@/components/progress-bar';
import type { UploadItem } from '@/features/files/use-uploads';
import { useAppTheme } from '@/theme/app-theme';
import { RADIUS, SPACE } from '@/theme/layout';

/** Picked photos as thumbnails, each with its own upload progress, retry and remove. */
export function PhotoStrip({
  items,
  onRetry,
  onRemove,
}: {
  readonly items: readonly UploadItem[];
  readonly onRetry: (key: string) => void;
  readonly onRemove: (key: string) => void;
}) {
  const { colors, status } = useAppTheme();
  if (items.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.strip}
    >
      {items.map((item, index) => (
        <View key={item.key} style={styles.tile}>
          <Image
            source={{ uri: item.file.uri }}
            style={[styles.photo, { backgroundColor: colors.surfaceSunken }]}
            contentFit="cover"
            accessibilityLabel={`Photo ${index + 1}`}
          />
          <View style={styles.corner}>
            <IconButton
              icon={item.status === 'failed' ? 'refresh' : 'close'}
              tone="filled"
              accessibilityLabel={
                item.status === 'failed' ? `Retry photo ${index + 1}` : `Remove photo ${index + 1}`
              }
              onPress={() => (item.status === 'failed' ? onRetry(item.key) : onRemove(item.key))}
            />
          </View>
          <View style={styles.progress}>
            {item.status === 'failed' ? (
              <AppText variant="label" color={status.overdue.fg}>
                Failed — tap retry
              </AppText>
            ) : (
              <ProgressBar
                value={item.progress}
                height={4}
                color={item.status === 'done' ? status.onTrack.solid : undefined}
                accessibilityLabel={`Photo ${index + 1} upload`}
              />
            )}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  strip: { gap: SPACE.sm },
  tile: { width: 112, gap: SPACE.xs },
  photo: { width: 112, height: 112, borderRadius: RADIUS.md },
  corner: { position: 'absolute', top: -6, right: -6 },
  progress: { minHeight: 16, justifyContent: 'center' },
});
