import type { ReactNode } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { useAppTheme } from '@/theme/app-theme';
import { SPACE } from '@/theme/layout';
import { AppText } from './app-text';

export interface SectionHeaderProps {
  readonly title: string;
  /** A count or short status shown in mono beside the title. */
  readonly meta?: string | undefined;
  readonly action?: ReactNode | undefined;
}

/** Overline-style section label, quiet enough to let content lead. */
export function SectionHeader({ title, meta, action }: SectionHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <AppText variant="overline" tone="secondary" accessibilityRole="header">
          {title}
        </AppText>
        {meta ? (
          <AppText variant="mono" tone="tertiary">
            {meta}
          </AppText>
        ) : null}
      </View>
      {action}
    </View>
  );
}

export function Section({
  title,
  meta,
  action,
  children,
  style,
}: SectionHeaderProps & { readonly children: ReactNode; readonly style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.section, style]}>
      <SectionHeader title={title} meta={meta} action={action} />
      {children}
    </View>
  );
}

export function Divider({ inset = 0 }: { readonly inset?: number }) {
  const { colors } = useAppTheme();
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: colors.borderSubtle,
        marginLeft: inset,
      }}
    />
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 32,
  },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: SPACE.sm },
  section: { gap: SPACE.md },
});
