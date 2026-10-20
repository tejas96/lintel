import type { StatusColor } from '@lintel/design-system/tokens';
import { StyleSheet, View } from 'react-native';
import { type AppTheme, useAppTheme } from '@/theme/app-theme';
import { RADIUS, SPACE } from '@/theme/layout';
import type { StatusPresentation } from '@/theme/status-vocabulary';
import { AppText } from './app-text';
import { Icon } from './icon';

export function statusColors(theme: AppTheme, tone: StatusPresentation['tone']): StatusColor {
  return tone === 'neutral' ? theme.neutralStatus : theme.status[tone];
}

export interface StatusPillProps {
  readonly status: StatusPresentation;
  readonly size?: 'sm' | 'md';
}

/** Colour + glyph + word. Screen readers hear the word only. */
export function StatusPill({ status, size = 'sm' }: StatusPillProps) {
  const theme = useAppTheme();
  const colors = statusColors(theme, status.tone);
  return (
    <View
      accessible
      accessibilityLabel={status.label}
      style={[styles.pill, size === 'md' ? styles.medium : null, { backgroundColor: colors.tint }]}
    >
      <Icon name={status.icon} size={size === 'md' ? 14 : 12} color={colors.fg} weight="semibold" />
      <AppText variant="label" color={colors.fg} numberOfLines={1}>
        {status.label}
      </AppText>
    </View>
  );
}

/** A small solid dot used where a pill would be too loud (list rails, legends). */
export function StatusDot({ tone }: { readonly tone: StatusPresentation['tone'] }) {
  const theme = useAppTheme();
  return <View style={[styles.dot, { backgroundColor: statusColors(theme, tone).solid }]} />;
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: SPACE.xs,
    paddingHorizontal: SPACE.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  medium: { paddingHorizontal: SPACE.md, paddingVertical: SPACE.xs },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
