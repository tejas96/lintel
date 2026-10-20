import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '@/theme/app-theme';
import { SPACE, TOUCH_TARGET } from '@/theme/layout';
import { AppText } from './app-text';
import { Icon, type IconName } from './icon';
import { PressableScale } from './pressable-scale';

export interface ListRowProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly icon?: IconName;
  readonly leading?: ReactNode;
  readonly trailing?: ReactNode;
  readonly onPress?: () => void;
  readonly showChevron?: boolean;
  readonly accessibilityHint?: string;
  readonly destructive?: boolean;
}

/** A settings-style row. Rows with `onPress` are buttons; others are plain text. */
export function ListRow({
  title,
  subtitle,
  icon,
  leading,
  trailing,
  onPress,
  showChevron = Boolean(onPress),
  accessibilityHint,
  destructive = false,
}: ListRowProps) {
  const { colors, status } = useAppTheme();
  const titleColor = destructive ? status.overdue.fg : colors.textPrimary;
  const content = (
    <>
      {leading ??
        (icon ? (
          <Icon
            name={icon}
            size={20}
            color={destructive ? status.overdue.fg : colors.textSecondary}
          />
        ) : null)}
      <View style={styles.text}>
        <AppText variant="body" color={titleColor} numberOfLines={2}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="bodySm" tone="secondary" numberOfLines={3}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {trailing}
      {showChevron ? <Icon name="chevronRight" size={14} color={colors.textTertiary} /> : null}
    </>
  );
  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      {...(accessibilityHint ? { accessibilityHint } : {})}
      onPress={onPress}
      pressedScale={0.985}
      style={styles.row}
    >
      {content}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    minHeight: TOUCH_TARGET + SPACE.sm,
    paddingVertical: SPACE.sm,
  },
  text: { flex: 1, gap: 2 },
});
