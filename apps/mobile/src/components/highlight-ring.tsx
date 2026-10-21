import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '@/theme/app-theme';
import { RADIUS } from '@/theme/layout';

/**
 * The soft accent ring a link draws around what it is about (a nudge, an
 * approval), 2 pt outside the content like a focus ring with an offset. The
 * wrapper is always there, so turning the ring on never moves the layout.
 */
export function HighlightRing({
  active,
  children,
}: {
  readonly active: boolean;
  readonly children: ReactNode;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.ring, { borderColor: active ? `${colors.focusRing}59` : 'transparent' }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { borderWidth: 2, borderRadius: RADIUS.lg + 4, padding: 2, margin: -4 },
});
