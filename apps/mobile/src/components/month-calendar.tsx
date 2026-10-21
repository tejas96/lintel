import { addDays, type CalendarDate, isoWeekday, toCalendarDate } from '@lintel/shared';
import { StyleSheet, View } from 'react-native';
import { haptics } from '@/feedback/haptics';
import { useAppTheme } from '@/theme/app-theme';
import { RADIUS, SPACE } from '@/theme/layout';
import { AppText } from './app-text';
import { IconButton } from './icon-button';
import { PressableScale } from './pressable-scale';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const MONTH = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const SPOKEN = new Intl.DateTimeFormat('en-IN', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

/** How a day is drawn: an end of the selection (solid), inside it (soft) or plain. */
export type DayMark = 'edge' | 'inside' | null;

export function firstOfMonth(date: CalendarDate): CalendarDate {
  return toCalendarDate(`${date.slice(0, 7)}-01`);
}

function shiftMonth(first: CalendarDate, months: number): CalendarDate {
  const year = Number(first.slice(0, 4));
  const month = Number(first.slice(5, 7)) - 1 + months;
  const shifted = new Date(Date.UTC(year, month, 1));
  return toCalendarDate(shifted.toISOString().slice(0, 10));
}

/** Six rows of seven days starting on the Monday on or before the 1st. */
function monthGrid(first: CalendarDate): CalendarDate[] {
  const start = addDays(first, -(isoWeekday(first) - 1));
  return Array.from({ length: 42 }, (_, offset) => addDays(start, offset));
}

function CalendarDay({
  day,
  inMonth,
  isToday,
  mark,
  disabled,
  onPress,
}: {
  readonly day: CalendarDate;
  readonly inMonth: boolean;
  readonly isToday: boolean;
  readonly mark: DayMark;
  readonly disabled: boolean;
  readonly onPress: (day: CalendarDate) => void;
}) {
  const { colors } = useAppTheme();
  const quiet = inMonth && !disabled ? colors.textPrimary : colors.textTertiary;
  const textColor =
    mark === 'edge' ? colors.onAccent : mark === 'inside' ? colors.onAccentSoft : quiet;
  const spoken = SPOKEN.format(new Date(`${day}T00:00:00Z`));
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={isToday ? `${spoken}, today` : spoken}
      accessibilityState={{ selected: mark !== null, disabled }}
      disabled={disabled}
      onPress={() => {
        haptics.selection();
        onPress(day);
      }}
      pressedScale={0.9}
      style={[styles.cell, styles.day, disabled ? styles.disabled : null]}
    >
      <View
        style={[
          styles.dayInner,
          mark ? { backgroundColor: mark === 'edge' ? colors.accent : colors.accentSoft } : null,
          isToday && mark !== 'edge' ? { borderColor: colors.accent, borderWidth: 1.5 } : null,
        ]}
      >
        <AppText variant="body" color={textColor} style={styles.number}>
          {Number(day.slice(8, 10))}
        </AppText>
      </View>
    </PressableScale>
  );
}

export interface MonthCalendarProps {
  readonly today: CalendarDate;
  /** The first day of the month on show. */
  readonly month: CalendarDate;
  readonly onMonthChange: (month: CalendarDate) => void;
  readonly markFor: (day: CalendarDate) => DayMark;
  readonly onPress: (day: CalendarDate) => void;
  /** Days before this cannot be chosen, and earlier months are not offered. */
  readonly min?: CalendarDate;
}

/** One month of days, Monday first. Today wears the accent ring ("now"). */
export function MonthCalendar({
  today,
  month,
  onMonthChange,
  markFor,
  onPress,
  min,
}: MonthCalendarProps) {
  const monthPrefix = month.slice(0, 7);
  const atFirstMonth = min !== undefined && month <= firstOfMonth(min);
  return (
    <View style={styles.calendar}>
      <View style={styles.header}>
        <IconButton
          icon="back"
          accessibilityLabel="Previous month"
          disabled={atFirstMonth}
          onPress={() => onMonthChange(shiftMonth(month, -1))}
        />
        <AppText variant="titleMd" accessibilityRole="header">
          {MONTH.format(new Date(`${month}T00:00:00Z`))}
        </AppText>
        <IconButton
          icon="chevronRight"
          accessibilityLabel="Next month"
          onPress={() => onMonthChange(shiftMonth(month, 1))}
        />
      </View>
      <View style={styles.row}>
        {WEEKDAYS.map((weekday) => (
          <AppText key={weekday} variant="label" tone="tertiary" align="center" style={styles.cell}>
            {weekday}
          </AppText>
        ))}
      </View>
      <View style={styles.grid}>
        {monthGrid(month).map((day) => (
          <CalendarDay
            key={day}
            day={day}
            inMonth={day.startsWith(monthPrefix)}
            isToday={day === today}
            mark={markFor(day)}
            disabled={min !== undefined && day < min}
            onPress={onPress}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  calendar: { gap: SPACE.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%` },
  day: { aspectRatio: 1, padding: 2 },
  disabled: { opacity: 0.4 },
  number: { fontVariant: ['tabular-nums'] },
  dayInner: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.full },
});
