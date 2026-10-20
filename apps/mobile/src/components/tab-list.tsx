import type { ReactElement } from 'react';
import { FlatList, type ListRenderItem, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/theme/app-theme';
import { GUTTER, MAX_CONTENT_WIDTH, SPACE } from '@/theme/layout';
import { TabRootFrame, usePullToRefresh } from './screen';

export interface TabListProps<T> {
  readonly data: readonly T[];
  readonly renderItem: ListRenderItem<T>;
  readonly keyExtractor: (item: T) => string;
  readonly header: ReactElement;
  /** Shown instead of items while loading, on error or when empty. */
  readonly placeholder?: ReactElement | null;
  readonly onRefresh: () => Promise<unknown>;
  readonly onEndReached?: () => void;
  readonly footer?: ReactElement | null;
  /** Tab roots start under the status bar; stack screens sit under a native header. */
  readonly edge?: 'tab' | 'stack';
}

/** A virtualised list page with the editorial header, readable width and pull-to-refresh. */
export function TabList<T>({
  data,
  renderItem,
  keyExtractor,
  header,
  placeholder,
  onRefresh,
  onEndReached,
  footer,
  edge = 'tab',
}: TabListProps<T>) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const pull = usePullToRefresh(onRefresh);
  const list = (
    <FlatList
      data={data}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      style={{ backgroundColor: colors.canvas }}
      contentInsetAdjustmentBehavior={edge === 'stack' ? 'automatic' : 'never'}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      ListHeaderComponent={<View style={styles.header}>{header}</View>}
      ListEmptyComponent={placeholder ?? undefined}
      ListFooterComponent={footer ?? undefined}
      ItemSeparatorComponent={Separator}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      refreshControl={
        <RefreshControl
          refreshing={pull.refreshing}
          onRefresh={pull.onRefresh}
          tintColor={colors.accent}
          colors={[colors.accent]}
          progressBackgroundColor={colors.surfaceRaised}
        />
      }
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: SPACE.lg,
          paddingBottom: insets.bottom + SPACE.huge * 2,
        },
      ]}
    />
  );
  if (edge === 'stack') return list;
  return <TabRootFrame>{list}</TabRootFrame>;
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: GUTTER,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH + GUTTER * 2,
    alignSelf: 'center',
  },
  header: { gap: SPACE.xl, marginBottom: SPACE.xl },
  separator: { height: SPACE.md },
});
