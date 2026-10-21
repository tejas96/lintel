import type { CalendarDate } from '@lintel/shared';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/app-text';
import { type DayMark, firstOfMonth, MonthCalendar } from '@/components/month-calendar';
import { SPACE } from '@/theme/layout';

export interface DateRange {
  readonly start: CalendarDate;
  readonly end: CalendarDate;
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

  const choose = (day: CalendarDate) => {
    if (anchor === null) {
      setAnchor(day);
      onChange({ start: day, end: day });
      return;
    }
    onChange(day < anchor ? { start: day, end: anchor } : { start: anchor, end: day });
    setAnchor(null);
  };
  const markFor = (day: CalendarDate): DayMark => {
    if (value === null || day < value.start || day > value.end) return null;
    return day === value.start || day === value.end ? 'edge' : 'inside';
  };

  return (
    <View style={styles.calendar}>
      <MonthCalendar
        today={today}
        month={month}
        onMonthChange={setMonth}
        markFor={markFor}
        onPress={choose}
      />
      <AppText variant="bodySm" tone="secondary" align="center">
        {anchor ? 'Now tap the last day' : 'Tap the first day of your leave'}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  calendar: { gap: SPACE.sm },
});
