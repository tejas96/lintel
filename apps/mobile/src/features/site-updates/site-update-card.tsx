import type { SiteUpdate } from '@lintel/api-contracts';
import { Image } from 'expo-image';
import { ScrollView, StyleSheet, View } from 'react-native';
import { fileContentSource } from '@/api/file-transfer';
import { AppText } from '@/components/app-text';
import { Avatar } from '@/components/avatar';
import { Card } from '@/components/card';
import { StatusPill } from '@/components/status-pill';
import { formatRelativeInstant } from '@/formatting/dates';
import { useAppTheme } from '@/theme/app-theme';
import { RADIUS, SPACE } from '@/theme/layout';

/** A dated note from site, with its photos and an issue flag when something is wrong. */
export function SiteUpdateCard({
  update,
  showProject = false,
}: {
  readonly update: SiteUpdate;
  readonly showProject?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <Card style={styles.card}>
      <View style={styles.byline}>
        <Avatar user={update.author} size={28} />
        <View style={styles.flex}>
          <AppText variant="label">{update.author.fullName}</AppText>
          <AppText variant="mono" tone="tertiary">
            {formatRelativeInstant(update.createdAt)}
            {showProject ? ` · ${update.project.reference}` : ''}
          </AppText>
        </View>
        {update.hasIssue ? (
          <StatusPill status={{ tone: 'atRisk', icon: 'error', label: 'Issue flagged' }} />
        ) : null}
      </View>
      <AppText variant="body">{update.note}</AppText>
      {update.task ? (
        <AppText variant="bodySm" tone="secondary">
          About #{update.task.number} {update.task.title}
        </AppText>
      ) : null}
      {update.photos.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.photos}
        >
          {update.photos.map((photo) => (
            <Image
              key={photo.id}
              source={fileContentSource(photo.id)}
              style={[styles.photo, { backgroundColor: colors.surfaceSunken }]}
              contentFit="cover"
              transition={160}
              accessibilityLabel={`Photo: ${photo.originalName}`}
            />
          ))}
        </ScrollView>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: SPACE.md },
  byline: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  flex: { flex: 1 },
  photos: { gap: SPACE.sm },
  photo: { width: 132, height: 132, borderRadius: RADIUS.md },
});
