import type { LeaveHandover, LeaveRequestDetail } from '@lintel/api-contracts';
import { StyleSheet, View } from 'react-native';
import { errorMessage } from '@/api/api-error';
import { AppText } from '@/components/app-text';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Divider, Section } from '@/components/section';
import { StatusPill } from '@/components/status-pill';
import { useToast } from '@/feedback/toast';
import { useDecideHandover } from '@/queries/leave-queries';
import { can } from '@/session/capabilities';
import { useCurrentUser } from '@/session/session-provider';
import { SPACE } from '@/theme/layout';
import type { StatusPresentation } from '@/theme/status-vocabulary';

const HANDOVER_STATUS: Readonly<Record<LeaveHandover['status'], StatusPresentation>> = {
  proposed: { tone: 'review', icon: 'pending', label: 'Proposed' },
  accepted: { tone: 'onTrack', icon: 'done', label: 'Accepted' },
  declined: { tone: 'neutral', icon: 'close', label: 'Declined' },
  applied: { tone: 'done', icon: 'done', label: 'Reassigned' },
};

function HandoverRow({
  handover,
  canApply,
}: {
  readonly handover: LeaveHandover;
  readonly canApply: boolean;
}) {
  const user = useCurrentUser();
  const toast = useToast();
  const decide = useDecideHandover();
  const run = (decision: 'accept' | 'decline' | 'apply', done: string) =>
    decide.mutate(
      { handoverId: handover.id, decision },
      {
        onSuccess: () => toast.show(done, 'success'),
        onError: (error) => toast.show(errorMessage(error), 'error'),
      },
    );
  const isRecipient = handover.to?.id === user.id && handover.status === 'proposed';
  const pending = decide.isPending ? decide.variables?.decision : undefined;
  return (
    <View style={styles.row}>
      <View style={styles.titleRow}>
        <AppText variant="body" style={styles.flex}>
          {handover.task.title}
        </AppText>
        <StatusPill status={HANDOVER_STATUS[handover.status]} />
      </View>
      {handover.to ? (
        <View style={styles.person}>
          <Avatar user={handover.to} size={22} />
          <AppText variant="bodySm" tone="secondary">
            To {handover.to.fullName}
          </AppText>
        </View>
      ) : null}
      {handover.note ? (
        <AppText variant="bodySm" tone="secondary">
          “{handover.note}”
        </AppText>
      ) : null}
      {isRecipient ? (
        <View style={styles.actions}>
          <Button
            label="Accept"
            onPress={() => run('accept', 'Handover accepted.')}
            loading={pending === 'accept'}
            fill
          />
          <Button
            label="Decline"
            variant="secondary"
            onPress={() => run('decline', 'Handover declined.')}
            loading={pending === 'decline'}
            fill
          />
        </View>
      ) : null}
      {canApply && handover.status === 'accepted' ? (
        <Button
          label="Reassign the task now"
          variant="secondary"
          onPress={() => run('apply', 'Task reassigned.')}
          loading={pending === 'apply'}
        />
      ) : null}
    </View>
  );
}

/** Proposed cover for the work this leave touches; recipients accept, managers apply. */
export function LeaveHandovers({ request }: { readonly request: LeaveRequestDetail }) {
  const user = useCurrentUser();
  // The server checks project rights; people who assign work see the action.
  const canAssign = can(user, 'tasks.assign') || can(user, 'tasks.manage_any');
  if (request.handovers.length === 0) return null;
  return (
    <Section title="Handovers" meta={String(request.handovers.length)}>
      <Card style={{ paddingVertical: SPACE.xs }}>
        {request.handovers.map((handover, index) => (
          <View key={handover.id}>
            {index > 0 ? <Divider /> : null}
            <HandoverRow handover={handover} canApply={canAssign} />
          </View>
        ))}
      </Card>
    </Section>
  );
}

const styles = StyleSheet.create({
  row: { gap: SPACE.sm, paddingVertical: SPACE.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  person: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  actions: { flexDirection: 'row', gap: SPACE.sm },
  flex: { flex: 1 },
});
