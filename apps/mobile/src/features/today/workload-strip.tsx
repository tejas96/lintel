import type { WorkQueue } from '@lintel/api-contracts';
import type { StatusTone } from '@lintel/design-system/tokens';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { ProgressBar } from '@/components/progress-bar';
import { StatusPill } from '@/components/status-pill';
import { formatMinutes } from '@/formatting/quantities';
import { useAppTheme } from '@/theme/app-theme';
import { SPACE } from '@/theme/layout';
import type { StatusPresentation } from '@/theme/status-vocabulary';

type Workload = WorkQueue['workload'];

const WORKLOAD: Readonly<Record<Workload['status'], StatusPresentation & { tone: StatusTone }>> = {
  available: { tone: 'onTrack', icon: 'done', label: 'Room to spare' },
  balanced: { tone: 'onTrack', icon: 'done', label: 'Balanced' },
  stretched: { tone: 'atRisk', icon: 'error', label: 'Stretched' },
  overloaded: { tone: 'overdue', icon: 'error', label: 'Overloaded' },
};

/** How full today is: committed work against the hours available. */
export function WorkloadStrip({ workload }: { readonly workload: Workload }) {
  const theme = useAppTheme();
  if (workload.onLeaveToday) {
    return (
      <Card tone="sunken">
        <AppText variant="titleMd">You’re on leave today</AppText>
        <AppText variant="bodySm" tone="secondary">
          Nothing here needs you. Anything urgent has been flagged to your manager.
        </AppText>
      </Card>
    );
  }
  const presentation = WORKLOAD[workload.status];
  const available = workload.availableMinutesToday;
  const committed = workload.committedMinutesToday;
  return (
    <View style={styles.strip}>
      <View style={styles.row}>
        <AppText variant="bodySm" tone="secondary" style={styles.text}>
          {formatMinutes(committed)} planned of {formatMinutes(available)} available
        </AppText>
        <StatusPill status={presentation} />
      </View>
      <ProgressBar
        value={available > 0 ? committed / available : 1}
        color={theme.status[presentation.tone].solid}
        accessibilityLabel={`Today's workload: ${presentation.label}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { gap: SPACE.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  text: { flex: 1 },
});
