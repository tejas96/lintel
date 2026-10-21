import type { CalendarDate } from '@lintel/shared';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { formatShortDate, relativeDayLabel } from '@/formatting/dates';
import { useAppTheme } from '@/theme/app-theme';
import { RADIUS, SPACE, TOUCH_TARGET } from '@/theme/layout';
import { fadeIn, layoutTransition } from '@/theme/motion';
import { AppText } from './app-text';
import { Icon } from './icon';
import { firstOfMonth, MonthCalendar } from './month-calendar';
import { PressableScale } from './pressable-scale';

export interface DateFieldProps {
  readonly label: string;
  readonly value: CalendarDate | null;
  readonly onChange: (value: CalendarDate | null) => void;
  readonly today: CalendarDate;
  /** The earliest day that can be chosen. */
  readonly min?: CalendarDate;
  /** The calendar is open; the parent keeps one open at a time. */
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly hint?: string;
  readonly error?: string | null;
  /** Optional fields can be emptied again. */
  readonly clearable?: boolean;
}

/** The label, with "Clear" beside it once an optional date is chosen. */
function DateFieldLabel({
  label,
  onClear,
}: {
  readonly label: string;
  readonly onClear: (() => void) | null;
}) {
  return (
    <View style={styles.labelRow}>
      <AppText variant="label" tone="secondary">
        {label}
      </AppText>
      {onClear ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`Clear ${label.toLowerCase()}`}
          hitSlop={12}
          onPress={onClear}
        >
          <AppText variant="label" tone="accent">
            Clear
          </AppText>
        </PressableScale>
      ) : null}
    </View>
  );
}

/** The error (spoken when it appears) or else the hint, under the field. */
function DateFieldMessage({
  hint,
  error,
}: {
  readonly hint?: string;
  readonly error: string | null;
}) {
  const { status } = useAppTheme();
  if (error) {
    return (
      <AppText variant="bodySm" color={status.overdue.fg} accessibilityLiveRegion="polite">
        {error}
      </AppText>
    );
  }
  return hint ? (
    <AppText variant="bodySm" tone="tertiary">
      {hint}
    </AppText>
  ) : null;
}

/** The row that shows the chosen day (or asks for one) and opens the calendar. */
function DateFieldTrigger({
  label,
  shown,
  open,
  onPress,
}: {
  readonly label: string;
  readonly shown: string | null;
  readonly open: boolean;
  readonly onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${shown ?? 'not chosen'}`}
      accessibilityHint={open ? 'Closes the calendar' : 'Opens a calendar'}
      accessibilityState={{ expanded: open }}
      pressedScale={0.99}
      onPress={onPress}
      style={styles.trigger}
    >
      <Icon name="calendar" size={18} color={shown ? colors.accent : colors.textTertiary} />
      <AppText
        variant="body"
        {...(shown ? {} : { tone: 'tertiary' as const })}
        style={styles.flex}
        numberOfLines={1}
      >
        {shown ?? 'Choose a date'}
      </AppText>
      <Icon
        name="chevronDown"
        size={14}
        color={colors.textTertiary}
        style={open ? styles.flipped : null}
      />
    </PressableScale>
  );
}

/** A date input that opens its month calendar in place; choosing a day closes it. */
export function DateField({
  label,
  value,
  onChange,
  today,
  min,
  open,
  onOpenChange,
  hint,
  error,
  clearable = false,
}: DateFieldProps) {
  const { colors, status } = useAppTheme();
  const [month, setMonth] = useState(() => firstOfMonth(value ?? min ?? today));
  const borderColor = error ? status.overdue.solid : open ? colors.focusRing : colors.borderStrong;
  const shown = value ? `${formatShortDate(value)} · ${relativeDayLabel(value, today)}` : null;
  return (
    <View style={styles.field}>
      <DateFieldLabel label={label} onClear={clearable && value ? () => onChange(null) : null} />
      <Animated.View
        layout={layoutTransition}
        style={[
          styles.box,
          {
            backgroundColor: colors.surfaceRaised,
            borderColor,
            borderWidth: open || error ? 1.5 : 1,
          },
        ]}
      >
        <DateFieldTrigger
          label={label}
          shown={shown}
          open={open}
          onPress={() => onOpenChange(!open)}
        />
        {open ? (
          <Animated.View entering={fadeIn} style={styles.calendar}>
            <MonthCalendar
              today={today}
              month={month}
              onMonthChange={setMonth}
              markFor={(day) => (day === value ? 'edge' : null)}
              onPress={(day) => {
                onChange(day);
                onOpenChange(false);
              }}
              {...(min ? { min } : {})}
            />
          </Animated.View>
        ) : null}
      </Animated.View>
      <DateFieldMessage error={error ?? null} {...(hint ? { hint } : {})} />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: SPACE.xs },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  box: { borderRadius: RADIUS.md, overflow: 'hidden' },
  trigger: {
    minHeight: TOUCH_TARGET + 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    paddingHorizontal: SPACE.md,
  },
  flex: { flex: 1 },
  flipped: { transform: [{ rotate: '180deg' }] },
  calendar: { paddingHorizontal: SPACE.sm, paddingBottom: SPACE.sm },
});
