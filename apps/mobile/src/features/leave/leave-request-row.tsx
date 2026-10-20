import type { LeaveRequest } from '@lintel/api-contracts';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/app-text';
import { Avatar } from '@/components/avatar';
import { Card } from '@/components/card';
import { StatusPill } from '@/components/status-pill';
import { formatDateRange } from '@/formatting/dates';
import { SPACE } from '@/theme/layout';
import { leaveStatusPresentation } from '@/theme/status-vocabulary';

/** A leave request: type, dates and duration, status; shows the person when deciding. */
export function LeaveRequestRow({
  request,
  showPerson,
}: {
  readonly request: LeaveRequest;
  readonly showPerson: boolean;
}) {
  const router = useRouter();
  const status = leaveStatusPresentation(request.status);
  return (
    <Card
      onPress={() => router.push({ pathname: '/leave/[id]', params: { id: request.id } })}
      accessibilityLabel={`${showPerson ? `${request.user.fullName}, ` : ''}${request.leaveType.name}, ${formatDateRange(request.startDate, request.endDate)}, ${status.label}`}
      style={styles.card}
    >
      {showPerson ? (
        <View style={styles.person}>
          <Avatar user={request.user} size={28} />
          <AppText variant="titleMd" style={styles.flex}>
            {request.user.fullName}
          </AppText>
        </View>
      ) : null}
      <View style={styles.titleRow}>
        <AppText variant={showPerson ? 'body' : 'titleMd'} style={styles.flex}>
          {request.leaveType.name}
          {request.isUrgentAbsence ? ' · unplanned' : ''}
        </AppText>
        <AppText variant="mono" tone="secondary">
          {request.durationLabel}
        </AppText>
      </View>
      <AppText variant="bodySm" tone="secondary">
        {formatDateRange(request.startDate, request.endDate)}
        {request.dayPortion === 'first_half'
          ? ' · morning'
          : request.dayPortion === 'second_half'
            ? ' · afternoon'
            : ''}
      </AppText>
      <StatusPill status={status} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: SPACE.sm },
  person: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: SPACE.sm },
  flex: { flex: 1 },
});
