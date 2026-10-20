import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/theme/app-theme';
import { GUTTER, SPACE } from '@/theme/layout';
import { AppText } from './app-text';

export interface SheetLayoutProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly children: ReactNode;
  /** Fixed at the bottom of the sheet (primary action). */
  readonly footer?: ReactNode;
}

/** Content of a native form sheet: a title, scrollable body and a footer above the keyboard. */
export function SheetLayout({ title, subtitle, children, footer }: SheetLayoutProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAwareScrollView
      bottomOffset={SPACE.xl}
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: colors.surface }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACE.xl }]}
    >
      <View style={styles.heading}>
        <AppText variant="titleLg">{title}</AppText>
        {subtitle ? (
          <AppText variant="bodySm" tone="secondary" numberOfLines={3}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {children}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: GUTTER, paddingTop: SPACE.xxl, gap: SPACE.lg },
  heading: { gap: SPACE.xs },
  footer: { gap: SPACE.sm, marginTop: SPACE.sm },
});
