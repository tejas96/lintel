import type { ApprovalItem } from '@lintel/api-contracts';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/app-text';
import { Avatar } from '@/components/avatar';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { StatusPill } from '@/components/status-pill';
import { formatRelativeInstant } from '@/formatting/dates';
import { hrefForLinkPath } from '@/push/link-routing';
import { useAppTheme } from '@/theme/app-theme';
import { SPACE } from '@/theme/layout';

/** Kinds the app has a decision screen for; the rest are decided on the web. */
const DECIDED_IN_APP: ReadonlySet<ApprovalItem['type']> = new Set([
  'deliverable_review',
  'task_review',
  'leave_request',
]);

/** The in-app screen for an item: its server link first, then its type and id. */
export function approvalHref(item: ApprovalItem): Href | null {
  const linked = hrefForLinkPath(item.linkPath);
  if (linked) return linked;
  if (item.type === 'task_review') return { pathname: '/tasks/[id]', params: { id: item.id } };
  if (item.type === 'leave_request') return { pathname: '/leave/[id]', params: { id: item.id } };
  if (item.type === 'deliverable_review') {
    return { pathname: '/deliverables/[id]', params: { id: item.id } };
  }
  return null;
}

/** One decision waiting on the viewer; items the app can't open say where to decide. */
export function ApprovalRow({ item }: { readonly item: ApprovalItem }) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const href = approvalHref(item);
  const decidedHere = DECIDED_IN_APP.has(item.type);
  const body = (
    <>
      <View style={styles.top}>
        {item.project ? (
          <AppText variant="mono" tone="secondary" style={styles.flex} numberOfLines={1}>
            {item.project.reference} · {item.project.name}
          </AppText>
        ) : (
          <View style={styles.flex} />
        )}
        {item.urgency === 'high' ? (
          <StatusPill status={{ tone: 'atRisk', icon: 'flag', label: 'Urgent' }} />
        ) : null}
      </View>
      <AppText variant="titleMd">{item.title}</AppText>
      <AppText variant="bodySm" tone="secondary">
        {item.subtitle}
      </AppText>
      <View style={styles.bottom}>
        {item.requestedBy ? <Avatar user={item.requestedBy} size={22} /> : null}
        <AppText variant="bodySm" tone="secondary" style={styles.flex}>
          {item.requestedBy ? `${item.requestedBy.fullName} · ` : ''}
          {formatRelativeInstant(item.requestedAt)}
        </AppText>
        {href ? <Icon name="chevronRight" size={14} color={colors.textTertiary} /> : null}
      </View>
      {decidedHere ? null : (
        <AppText variant="label" tone="tertiary">
          {href
            ? 'Decide this in Lintel on the web. Opens the project for context.'
            : 'Decide this in Lintel on the web.'}
        </AppText>
      )}
    </>
  );
  if (!href) return <Card style={styles.card}>{body}</Card>;
  return (
    <Card
      style={styles.card}
      onPress={() => router.push(href)}
      accessibilityLabel={`${item.title}. ${item.subtitle}`}
      accessibilityHint={decidedHere ? 'Opens it to decide' : 'Opens the project'}
    >
      {body}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: SPACE.sm },
  top: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  flex: { flex: 1 },
});
