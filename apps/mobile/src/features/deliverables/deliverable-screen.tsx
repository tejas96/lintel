import type { DeliverableDetail, DeliverableVersion } from '@lintel/api-contracts';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { fileContentSource } from '@/api/file-transfer';
import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { ListRow } from '@/components/list-row';
import { ScreenScroll } from '@/components/screen';
import { Divider, Section } from '@/components/section';
import { SkeletonList } from '@/components/skeleton';
import { ErrorState } from '@/components/state-views';
import { StatusPill } from '@/components/status-pill';
import { FileTile } from '@/features/files/file-views';
import { formatInstant } from '@/formatting/dates';
import { useDeliverable } from '@/queries/deliverable-queries';
import { useAppTheme } from '@/theme/app-theme';
import { RADIUS, SPACE } from '@/theme/layout';
import { deliverableStatusPresentation, type StatusPresentation } from '@/theme/status-vocabulary';
import { ReviewPanel } from './review-panel';
import { SubmitVersionPanel } from './submit-version-panel';

const DECISION: Readonly<Record<DeliverableVersion['decision'], StatusPresentation>> = {
  pending: { tone: 'review', icon: 'pending', label: 'Awaiting review' },
  approved: { tone: 'onTrack', icon: 'done', label: 'Approved' },
  changes_requested: { tone: 'atRisk', icon: 'refresh', label: 'Changes requested' },
  rejected: { tone: 'overdue', icon: 'close', label: 'Rejected' },
};

function VersionRow({ version }: { readonly version: DeliverableVersion }) {
  return (
    <View style={styles.version}>
      <View style={styles.versionTitle}>
        <AppText variant="titleMd" style={styles.flex}>
          Version {version.versionNumber}
        </AppText>
        <StatusPill status={DECISION[version.decision]} />
      </View>
      <FileTile file={version.file} size={56} />
      <AppText variant="bodySm" tone="secondary">
        {version.submittedBy.fullName} · {formatInstant(version.submittedAt)}
      </AppText>
      {version.note ? <AppText variant="bodySm">“{version.note}”</AppText> : null}
      {version.reviewedBy && version.reviewComment ? (
        <AppText variant="bodySm" tone="secondary">
          {version.reviewedBy.fullName}: “{version.reviewComment}”
        </AppText>
      ) : null}
    </View>
  );
}

function DeliverableBody({ data }: { readonly data: DeliverableDetail }) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const latest = data.latestVersion;
  const versions = [...data.versions].sort(
    (left, right) => right.versionNumber - left.versionNumber,
  );
  return (
    <>
      <View style={styles.header}>
        <AppText variant="mono" tone="secondary">
          {data.project.reference} · {data.project.name}
        </AppText>
        <AppText variant="displayMd">{data.name}</AppText>
        <StatusPill status={deliverableStatusPresentation(data.status)} size="md" />
        {data.description ? <AppText variant="body">{data.description}</AppText> : null}
        <AppText variant="bodySm" tone="secondary">
          {data.isRequired ? 'Required' : 'Optional'}
          {data.reviewer ? ` · Reviewer ${data.reviewer.fullName}` : ' · No reviewer assigned'}
        </AppText>
      </View>
      {latest?.file.isImage ? (
        <Image
          source={fileContentSource(latest.file.id)}
          style={[styles.preview, { backgroundColor: colors.surfaceSunken }]}
          contentFit="contain"
          transition={200}
          accessibilityLabel={`Version ${latest.versionNumber}: ${latest.file.originalName}`}
        />
      ) : null}
      {data.viewerCanReview && latest?.decision === 'pending' ? (
        <ReviewPanel deliverable={data} version={latest} />
      ) : null}
      {data.viewerCanSubmit ? <SubmitVersionPanel deliverable={data} /> : null}
      {data.task ? (
        <ListRow
          icon="dependency"
          title={data.task.title}
          subtitle={`Task #${data.task.number}`}
          onPress={() =>
            router.push({ pathname: '/tasks/[id]', params: { id: data.task?.id ?? '' } })
          }
        />
      ) : null}
      <Section title="Versions" meta={String(versions.length)}>
        {versions.length === 0 ? (
          <AppText variant="bodySm" tone="secondary">
            Nothing submitted yet.
          </AppText>
        ) : (
          <Card style={{ paddingVertical: SPACE.xs }}>
            {versions.map((version, index) => (
              <View key={version.id}>
                {index > 0 ? <Divider /> : null}
                <VersionRow version={version} />
              </View>
            ))}
          </Card>
        )}
      </Section>
    </>
  );
}

/** A deliverable: the latest version large, review or submit actions, then history. */
export function DeliverableScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const deliverable = useDeliverable(id);
  return (
    <ScreenScroll edge="stack" onRefresh={() => deliverable.refetch()}>
      {deliverable.isPending ? <SkeletonList count={3} label="Loading deliverable" /> : null}
      {deliverable.isError ? (
        <ErrorState
          error={deliverable.error}
          subject="this deliverable"
          onRetry={() => void deliverable.refetch()}
        />
      ) : null}
      {deliverable.data ? <DeliverableBody data={deliverable.data} /> : null}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  header: { gap: SPACE.sm },
  preview: { width: '100%', aspectRatio: 4 / 3, borderRadius: RADIUS.lg },
  version: { gap: SPACE.sm, paddingVertical: SPACE.md },
  versionTitle: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  flex: { flex: 1 },
});
