import { addDays, type CalendarDate, isoWeekday, toCalendarDate } from '@lintel/shared';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/icon-button';
import { PressableScale } from '@/components/pressable-scale';
import { haptics } from '@/feedback/haptics';
import { useAppTheme } from '@/theme/app-theme';
import { RADIUS, SPACE } from '@/theme/layout';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const MONTH = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const SPOKEN = new Intl.DateTimeFormat('en-IN', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

export interface DateRange {
  readonly start: CalendarDate;
  readonly end: CalendarDate;
}

function firstOfMonth(date: CalendarDate): CalendarDate {
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
  range,
  onPress,
}: {
  readonly day: CalendarDate;
  readonly inMonth: boolean;
  readonly isToday: boolean;
  readonly range: DateRange | null;
  readonly onPress: (day: CalendarDate) => void;
}) {
  const { colors } = useAppTheme();
  const selected = range !== null && day >= range.start && day <= range.end;
  const isEdge = range !== null && (day === range.start || day === range.end);
  const quiet = inMonth ? colors.textPrimary : colors.textTertiary;
  const textColor = isEdge ? colors.onAccent : selected ? colors.onAccentSoft : quiet;
  const spoken = SPOKEN.format(new Date(`${day}T00:00:00Z`));
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={isToday ? `${spoken}, today` : spoken}
      accessibilityState={{ selected }}
      onPress={() => onPress(day)}
      pressedScale={0.9}
      style={[styles.cell, styles.day]}
    >
      <View
        style={[
          styles.dayInner,
          selected ? { backgroundColor: isEdge ? colors.accent : colors.accentSoft } : null,
          isToday && !isEdge ? { borderColor: colors.accent, borderWidth: 1.5 } : null,
        ]}
      >
        <AppText variant="body" color={textColor} style={styles.number}>
          {Number(day.slice(8, 10))}
        </AppText>
      </View>
    </PressableScale>
  );
}

export interface DateRangeCalendarProps {
  readonly today: CalendarDate;
  readonly value: DateRange | null;
  readonly onChange: (range: DateRange) => void;
}

/** Tap the first day, then the last. Today is marked with the accent ring ("now"). */
export function DateRangeCalendar({ today, value, onChange }: DateRangeCalendarProps) {
  const [month, setMonth] = useState(() => firstOfMonth(value?.start ?? today));
  const [anchor, setAnchor] = useState<CalendarDate | null>(null);
  const days = monthGrid(month);
  const monthPrefix = month.slice(0, 7);

  const choose = (day: CalendarDate) => {
    haptics.selection();
    if (anchor === null) {
      setAnchor(day);
      onChange({ start: day, end: day });
      return;
    }
    onChange(day < anchor ? { start: day, end: anchor } : { start: anchor, end: day });
    setAnchor(null);
  };

  return (
    <View style={styles.calendar}>
      <View style={styles.header}>
        <IconButton
          icon="back"
          accessibilityLabel="Previous month"
          onPress={() => setMonth(shiftMonth(month, -1))}
        />
        <AppText variant="titleMd" accessibilityRole="header">
          {MONTH.format(new Date(`${month}T00:00:00Z`))}
        </AppText>
        <IconButton
          icon="chevronRight"
          accessibilityLabel="Next month"
          onPress={() => setMonth(shiftMonth(month, 1))}
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
        {days.map((day) => (
          <CalendarDay
            key={day}
            day={day}
            inMonth={day.startsWith(monthPrefix)}
            isToday={day === today}
            range={value}
            onPress={choose}
          />
        ))}
      </View>
      <AppText variant="bodySm" tone="secondary" align="center">
        {anchor ? 'Now tap the last day' : 'Tap the first day of your leave'}
      </AppText>
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
  number: { fontVariant: ['tabular-nums'] },
  dayInner: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.full },
});
