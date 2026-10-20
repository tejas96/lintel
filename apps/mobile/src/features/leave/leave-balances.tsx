import type { LeaveBalance } from '@lintel/api-contracts';
import { ScrollView, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/app-text';
import { ProgressBar } from '@/components/progress-bar';
import { formatHalfDayNumber, formatHalfDays } from '@/formatting/quantities';
import { projectSwatch, useAppTheme } from '@/theme/app-theme';
import { HAIRLINE, RADIUS, SPACE } from '@/theme/layout';

function BalanceCard({ balance }: { readonly balance: LeaveBalance }) {
  const theme = useAppTheme();
  const allowance = balance.allowanceHalfDays;
  const remaining =
    allowance === null ? null : allowance - balance.usedHalfDays - balance.pendingHalfDays;
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderSubtle },
      ]}
      accessible
      accessibilityLabel={`${balance.leaveType.name}: ${remaining === null ? 'no fixed allowance' : `${formatHalfDays(remaining)} left`}`}
    >
      <View style={styles.title}>
        <View
          style={[
            styles.swatch,
            { backgroundColor: projectSwatch(theme, balance.leaveType.colorIndex) },
          ]}
        />
        <AppText variant="label" tone="secondary" numberOfLines={1}>
          {balance.leaveType.name}
        </AppText>
      </View>
      <AppText variant="displayMd">
        {remaining === null ? '—' : formatHalfDayNumber(Math.max(0, remaining))}
      </AppText>
      <AppText variant="bodySm" tone="secondary">
        {remaining === null ? 'No fixed allowance' : remaining === 2 ? 'day left' : 'days left'}
      </AppText>
      {allowance !== null && allowance > 0 ? (
        <ProgressBar
          value={(balance.usedHalfDays + balance.pendingHalfDays) / allowance}
          height={4}
          color={theme.colors.accent}
          accessibilityLabel={`${formatHalfDays(balance.usedHalfDays)} used of ${formatHalfDays(allowance)}`}
        />
      ) : null}
      <AppText variant="mono" tone="tertiary">
        {formatHalfDays(balance.usedHalfDays)} used
        {balance.pendingHalfDays > 0 ? ` · ${formatHalfDays(balance.pendingHalfDays)} pending` : ''}
      </AppText>
    </View>
  );
}

/** Balances in half days from the server, shown as editorial numerals. */
export function LeaveBalances({ balances }: { readonly balances: readonly LeaveBalance[] }) {
  if (balances.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {balances.map((balance) => (
        <BalanceCard key={balance.leaveType.id} balance={balance} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: SPACE.md },
  card: {
    width: 168,
    borderRadius: RADIUS.lg,
    borderWidth: HAIRLINE,
    padding: SPACE.lg,
    gap: SPACE.xs,
  },
  title: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  swatch: { width: 8, height: 8, borderRadius: 2 },
});
