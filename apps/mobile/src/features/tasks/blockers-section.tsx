import type { Blocker, TaskDetail } from '@lintel/api-contracts';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { Section } from '@/components/section';
import { formatRelativeInstant } from '@/formatting/dates';
import { useAppTheme } from '@/theme/app-theme';
import { RADIUS, SPACE } from '@/theme/layout';
import { isClosed } from './task-affordances';

export const BLOCKER_CATEGORY_LABELS: Readonly<Record<Blocker['category'], string>> = {
  client: 'Waiting on the client',
  supplier: 'Waiting on a supplier',
  internal_dependency: 'Waiting on other work',
  manager_decision: 'Needs a manager’s decision',
  information: 'Missing information',
  other: 'Something else',
};

function OpenBlocker({ blocker, taskId }: { readonly blocker: Blocker; readonly taskId: string }) {
  const router = useRouter();
  const { status } = useAppTheme();
  return (
    <View style={[styles.blocker, { backgroundColor: status.blocked.tint }]}>
      <View style={styles.titleRow}>
        <Icon name="blocked" size={16} color={status.blocked.fg} />
        <AppText variant="titleMd" color={status.blocked.fg} style={styles.flex}>
          {BLOCKER_CATEGORY_LABELS[blocker.category]}
        </AppText>
      </View>
      <AppText variant="body" color={status.blocked.fg}>
        {blocker.reason}
      </AppText>
      <AppText variant="bodySm" color={status.blocked.fg}>
        {blocker.waitingOn ? `Waiting on ${blocker.waitingOn.fullName} · ` : ''}
        Raised by {blocker.raisedBy.fullName}, {formatRelativeInstant(blocker.raisedAt)}
      </AppText>
      <Button
        label="Mark resolved"
        variant="secondary"
        icon="done"
        onPress={() =>
          router.push({
            pathname: '/blockers/[id]/resolve',
            params: { id: blocker.id, taskId },
          })
        }
      />
    </View>
  );
}

/** Open blockers first, with a way to resolve them; reporting is one tap away. */
export function BlockersSection({ task }: { readonly task: TaskDetail }) {
  const router = useRouter();
  const open = task.blockers.filter((blocker) => blocker.resolvedAt === null);
  const resolved = task.blockers.filter((blocker) => blocker.resolvedAt !== null);
  const closed = isClosed(task);
  if (open.length === 0 && closed) return null;
  return (
    <Section title="Blockers" meta={open.length > 0 ? `${open.length} open` : undefined}>
      {open.map((blocker) => (
        <OpenBlocker key={blocker.id} blocker={blocker} taskId={task.id} />
      ))}
      {open.length === 0 ? (
        <AppText variant="bodySm" tone="secondary">
          Nothing is in the way.{' '}
          {resolved.length > 0
            ? `${resolved.length} earlier blocker${resolved.length === 1 ? '' : 's'} resolved.`
            : ''}
        </AppText>
      ) : null}
      {closed ? null : (
        <Button
          label="Report a blocker"
          icon="blocked"
          variant="secondary"
          onPress={() => router.push({ pathname: '/tasks/[id]/blocker', params: { id: task.id } })}
        />
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  blocker: { borderRadius: RADIUS.lg, padding: SPACE.lg, gap: SPACE.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  flex: { flex: 1 },
});
