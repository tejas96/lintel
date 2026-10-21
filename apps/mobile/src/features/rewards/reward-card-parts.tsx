import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/app-text';
import { Icon, type IconName } from '@/components/icon';
import { projectSwatch, useAppTheme } from '@/theme/app-theme';
import { SPACE } from '@/theme/layout';

/** The project's identity swatch with its reference and name, in mono. */
export function ProjectLine({
  colorIndex,
  text,
}: {
  readonly colorIndex: number;
  readonly text: string;
}) {
  const theme = useAppTheme();
  return (
    <View style={styles.row}>
      <View style={[styles.swatch, { backgroundColor: projectSwatch(theme, colorIndex) }]} />
      <AppText variant="mono" tone="secondary" style={styles.flex} numberOfLines={1}>
        {text}
      </AppText>
    </View>
  );
}

/** One item of a plain list: a small quiet dot, never a checkbox (nothing is ticked yet). */
export function BulletLine({ children }: { readonly children: ReactNode }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.bulletRow}>
      <View style={[styles.bullet, { backgroundColor: colors.textTertiary }]} />
      <View style={styles.bulletText}>{children}</View>
    </View>
  );
}

/** A quiet line with a glyph: reassurance or a reason something is not offered. */
export function QuietNote({
  icon = 'info',
  children,
}: {
  readonly icon?: IconName;
  readonly children: string;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.quiet}>
      <Icon name={icon} size={16} color={colors.textTertiary} style={styles.quietIcon} />
      <AppText variant="bodySm" tone="secondary" style={styles.flex}>
        {children}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  swatch: { width: 8, height: 8, borderRadius: 2 },
  flex: { flex: 1 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md },
  /** Centred on the first line of body text (22 pt line height). */
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 8 },
  bulletText: { flex: 1, gap: 2 },
  quiet: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm },
  quietIcon: { marginTop: 2 },
});
