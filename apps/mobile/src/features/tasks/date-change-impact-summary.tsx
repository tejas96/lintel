import type { DateChangeImpact } from '@lintel/api-contracts';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/app-text';
import { formatDayMonth } from '@/formatting/dates';
import { pluralize } from '@/formatting/quantities';
import { SPACE } from '@/theme/layout';

function workingDays(count: number): string {
  return pluralize(count, 'working day');
}

function deliveryLine(impact: DateChangeImpact): string {
  const current = impact.currentForecastEndDate;
  const next = impact.forecastEndDate;
  if (!next || impact.forecastShiftWorkingDays === 0) {
    return current
      ? `The delivery forecast stays ${formatDayMonth(current)}.`
      : 'The delivery forecast does not move.';
  }
  const past =
    impact.projectEndImpactDays > 0
      ? `, ${workingDays(impact.projectEndImpactDays)} past the agreed ${formatDayMonth(impact.plannedEndDate)}`
      : '';
  const from = current ? ` from ${formatDayMonth(current)}` : '';
  return `The delivery forecast moves${from} to ${formatDayMonth(next)} (${workingDays(impact.forecastShiftWorkingDays)} later${past}).`;
}

/** What accepting does to the rest of the plan, shown before the decision. */
export function DateChangeImpactSummary({ impact }: { readonly impact: DateChangeImpact }) {
  const waiting = impact.waitingTasks.length;
  return (
    <View style={styles.box} accessibilityLabel="What accepting does" accessible={false}>
      <AppText variant="bodySm">
        {waiting === 0 && impact.dependentMoves.length === 0
          ? 'Nothing that waits on this task has to move.'
          : `${pluralize(waiting, 'task')} ${waiting === 1 ? 'waits' : 'wait'} for this one and would start before it ends.`}
      </AppText>
      {impact.dependentMoves.map((move) => (
        <AppText key={move.taskId} variant="bodySm" tone="secondary">
          {move.title}: {move.currentDueDate ? formatDayMonth(move.currentDueDate) : 'no date'} to{' '}
          {formatDayMonth(move.proposedDueDate)}
        </AppText>
      ))}
      {impact.slippingMilestones.map((milestone) => (
        <AppText key={milestone.id} variant="bodySm" tone="secondary">
          “{milestone.name}” is due {formatDayMonth(milestone.dueDate)}; its work would end{' '}
          {formatDayMonth(milestone.forecastDueDate)} ({workingDays(milestone.slipWorkingDays)}{' '}
          late).
        </AppText>
      ))}
      <AppText variant="bodySm" tone="tertiary">
        {deliveryLine(impact)}
      </AppText>
      {impact.movingWaitingTasksNeedsScopeChange && impact.dependentMoves.length > 0 ? (
        <AppText variant="bodySm" tone="tertiary">
          Moving the waiting tasks too would pass the agreed end, so that needs a scope change.
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({ box: { gap: SPACE.xs } });
