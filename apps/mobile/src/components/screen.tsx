import { type ReactNode, useCallback, useState } from 'react';
import { RefreshControl, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/theme/app-theme';
import { GUTTER, MAX_CONTENT_WIDTH, SPACE } from '@/theme/layout';
import { AppText } from './app-text';

/** Pull-to-refresh that only spins for a pull, not for background refetches. */
export function usePullToRefresh(refresh: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void refresh().finally(() => setRefreshing(false));
  }, [refresh]);
  return { refreshing, onRefresh };
}

export interface ScreenScrollProps {
  readonly children: ReactNode;
  /** Tab roots draw their own header under the status bar; stack screens have a native header. */
  readonly edge: 'tab' | 'stack';
  readonly onRefresh?: () => Promise<unknown>;
  readonly contentStyle?: StyleProp<ViewStyle>;
}

/**
 * Scrolling page with the warm canvas, a readable column on tablets,
 * pull-to-refresh, and focused inputs kept above the keyboard.
 */
export function ScreenScroll({ children, edge, onRefresh, contentStyle }: ScreenScrollProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const pull = usePullToRefresh(onRefresh ?? (() => Promise.resolve()));
  return (
    <KeyboardAwareScrollView
      bottomOffset={SPACE.xl}
      style={{ backgroundColor: colors.canvas }}
      contentInsetAdjustmentBehavior={edge === 'stack' ? 'automatic' : 'never'}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={pull.refreshing}
            onRefresh={pull.onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
            progressBackgroundColor={colors.surfaceRaised}
          />
        ) : undefined
      }
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: edge === 'tab' ? insets.top + SPACE.lg : SPACE.lg,
          paddingBottom: insets.bottom + SPACE.huge * 2,
        },
      ]}
    >
      <View style={[styles.column, contentStyle]}>{children}</View>
    </KeyboardAwareScrollView>
  );
}

export interface PageHeaderProps {
  readonly overline?: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly trailing?: ReactNode;
}

/** Editorial page title: a mono-cased overline, a serif headline, one quiet line. */
export function PageHeader({ overline, title, subtitle, trailing }: PageHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        {overline ? (
          <AppText variant="overline" tone="secondary">
            {overline}
          </AppText>
        ) : null}
        <AppText variant="displayLg">{title}</AppText>
        {subtitle ? (
          <AppText variant="body" tone="secondary">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {trailing}
    </View>
  );
}

export const screenStyles = StyleSheet.create({
  gutter: { paddingHorizontal: GUTTER },
  stack: { gap: SPACE.xxl },
});

const styles = StyleSheet.create({
  content: { paddingHorizontal: GUTTER },
  column: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', gap: SPACE.xxl },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md },
  headerText: { flex: 1, gap: SPACE.xs },
});
