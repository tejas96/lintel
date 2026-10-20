import type { LeaveRequestDetail } from '@lintel/api-contracts';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/app-text';
import { Avatar } from '@/components/avatar';
import { Card } from '@/components/card';
import { ScreenScroll } from '@/components/screen';
import { Divider, Section } from '@/components/section';
import { SkeletonList } from '@/components/skeleton';
import { ErrorState } from '@/components/state-views';
import { StatusPill } from '@/components/status-pill';
import { formatDateRange, formatInstant } from '@/formatting/dates';
import { useLeaveRequest } from '@/queries/leave-queries';
import { useCurrentUser } from '@/session/session-provider';
import { SPACE } from '@/theme/layout';
import { leaveStatusPresentation, type StatusPresentation } from '@/theme/status-vocabulary';
import { LeaveDecisionPanel, LeaveOwnerActions } from './leave-decision-panel';
import { LeaveHandovers } from './leave-handovers';
import { LeaveImpactPreview } from './leave-impact-preview';

type Step = LeaveRequestDetail['steps'][number];

const STEP_STATUS: Readonly<Record<Step['status'], StatusPresentation>> = {
  waiting: { tone: 'neutral', icon: 'waiting', label: 'Waiting' },
  pending: { tone: 'review', icon: 'pending', label: 'Deciding' },
  approved: { tone: 'onTrack', icon: 'done', label: 'Approved' },
  rejected: { tone: 'overdue', icon: 'close', label: 'Declined' },
  skipped: { tone: 'neutral', icon: 'close', label: 'Skipped' },
};

function ApprovalSteps({ steps }: { readonly steps: readonly Step[] }) {
  if (steps.length === 0) return null;
  return (
    <Section title="Approvals">
      <Card style={{ paddingVertical: SPACE.xs }}>
        {steps.map((step, index) => (
          <View key={`level-${step.level}`}>
            {index > 0 ? <Divider /> : null}
            <View style={styles.step}>
              {step.approver ? <Avatar user={step.approver} size={28} /> : null}
              <View style={styles.flex}>
                <AppText variant="body">
                  {step.approver?.fullName ?? `Level ${step.level} approver`}
                </AppText>
                {step.note ? (
                  <AppText variant="bodySm" tone="secondary">
                    “{step.note}”
                  </AppText>
                ) : null}
                {step.decidedAt ? (
                  <AppText variant="mono" tone="tertiary">
                    {formatInstant(step.decidedAt)}
                  </AppText>
                ) : null}
              </View>
              <StatusPill status={STEP_STATUS[step.status]} />
            </View>
          </View>
        ))}
      </Card>
    </Section>
  );
}

/** A leave request with its approval chain, impact, handovers and the viewer's actions. */
export function LeaveDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useCurrentUser();
  const request = useLeaveRequest(id);
  const data = request.data;
  return (
    <ScreenScroll edge="stack" onRefresh={() => request.refetch()}>
      {request.isPending ? <SkeletonList count={3} label="Loading leave request" /> : null}
      {request.isError ? (
        <ErrorState
          error={request.error}
          subject="this leave request"
          onRetry={() => void request.refetch()}
        />
      ) : null}
      {data ? (
        <>
          <View style={styles.header}>
            {data.user.id !== user.id ? (
              <View style={styles.person}>
                <Avatar user={data.user} size={32} />
                <AppText variant="titleMd">{data.user.fullName}</AppText>
              </View>
            ) : null}
            <AppText variant="overline" tone="secondary">
              {data.leaveType.name}
              {data.isUrgentAbsence ? ' · unplanned absence' : ''}
            </AppText>
            <AppText variant="displayMd">{formatDateRange(data.startDate, data.endDate)}</AppText>
            <AppText variant="body" tone="secondary">
              {data.durationLabel}
            </AppText>
            <StatusPill status={leaveStatusPresentation(data.status)} size="md" />
            {data.reason ? <AppText variant="body">{data.reason}</AppText> : null}
            {data.decisionNote ? (
              <Card tone="sunken">
                <AppText variant="bodySm">“{data.decisionNote}”</AppText>
              </Card>
            ) : null}
          </View>
          {data.viewerCanDecide ? <LeaveDecisionPanel request={data} /> : null}
          {data.user.id === user.id ? <LeaveOwnerActions request={data} /> : null}
          <ApprovalSteps steps={data.steps} />
          <Section title="Impact">
            <LeaveImpactPreview impact={data.impact} updating={false} />
          </Section>
          <LeaveHandovers request={data} />
        </>
      ) : null}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  header: { gap: SPACE.sm },
  person: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  step: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingVertical: SPACE.md },
  flex: { flex: 1, gap: 2 },
});
