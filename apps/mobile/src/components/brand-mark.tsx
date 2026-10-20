import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '@/theme/app-theme';
import { AppText } from './app-text';

/** The lintel: a beam resting on two posts, drawn in the accent colour. */
export function BrandMark({ size = 28 }: { readonly size?: number }) {
  const { colors } = useAppTheme();
  const unit = size / 10;
  const fill = { backgroundColor: colors.accent, borderRadius: unit * 0.2 };
  return (
    <View style={{ width: size, height: size }} accessible={false}>
      <View
        style={[
          fill,
          styles.absolute,
          { left: 0, top: unit * 1.6, width: size, height: unit * 1.4 },
        ]}
      />
      <View
        style={[
          fill,
          styles.absolute,
          { left: unit * 1.3, top: unit * 3, width: unit * 1.4, height: unit * 5.6 },
        ]}
      />
      <View
        style={[
          fill,
          styles.absolute,
          { left: unit * 7.3, top: unit * 3, width: unit * 1.4, height: unit * 5.6 },
        ]}
      />
      <View
        style={[
          fill,
          styles.absolute,
          {
            left: unit * 0.4,
            top: unit * 8.85,
            width: unit * 9.2,
            height: Math.max(1, unit * 0.3),
          },
        ]}
      />
    </View>
  );
}

export function BrandLockup() {
  return (
    <View style={styles.lockup} accessible accessibilityLabel="Lintel">
      <BrandMark />
      <AppText variant="displayMd" accessibilityElementsHidden importantForAccessibility="no">
        Lintel
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  absolute: { position: 'absolute' },
  lockup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
