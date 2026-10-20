import { createContext, type ReactNode, use, useCallback, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/app-text';
import { Icon, type IconName } from '@/components/icon';
import { useAppTheme } from '@/theme/app-theme';
import { RADIUS, SPACE } from '@/theme/layout';
import { haptics } from './haptics';

type ToastTone = 'success' | 'error' | 'info';

interface Toast {
  readonly id: number;
  readonly message: string;
  readonly tone: ToastTone;
}

interface ToastContextValue {
  show(message: string, tone?: ToastTone): void;
}

const ToastContext = createContext<ToastContextValue | null>(null);
const VISIBLE_MS = 3200;
const TONE_ICON: Readonly<Record<ToastTone, IconName>> = {
  success: 'done',
  error: 'error',
  info: 'info',
};

/** Short confirmations and refusals. Every toast is also announced to screen readers. */
export function ToastProvider({ children }: { readonly children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const nextId = useRef(1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string, tone: ToastTone = 'info') => {
    if (timer.current) clearTimeout(timer.current);
    const id = nextId.current++;
    setToast({ id, message, tone });
    if (tone === 'success') haptics.success();
    if (tone === 'error') haptics.error();
    AccessibilityInfo.announceForAccessibility(message);
    timer.current = setTimeout(
      () => setToast((current) => (current?.id === id ? null : current)),
      VISIBLE_MS,
    );
  }, []);

  const value = useMemo(() => ({ show }), [show]);
  return (
    <ToastContext value={value}>
      {children}
      {toast ? <ToastView key={toast.id} toast={toast} /> : null}
    </ToastContext>
  );
}

function ToastView({ toast }: { readonly toast: Toast }) {
  const { colors, status } = useAppTheme();
  const insets = useSafeAreaInsets();
  const accent =
    toast.tone === 'success'
      ? status.onTrack.solid
      : toast.tone === 'error'
        ? status.overdue.solid
        : colors.accent;
  return (
    <View pointerEvents="none" style={[styles.host, { bottom: insets.bottom + 72 }]}>
      <Animated.View
        entering={FadeInDown.springify().damping(22).reduceMotion(ReduceMotion.System)}
        exiting={FadeOutDown.duration(160).reduceMotion(ReduceMotion.System)}
        style={[styles.toast, { backgroundColor: colors.textPrimary }]}
      >
        <Icon name={TONE_ICON[toast.tone]} size={18} color={accent} weight="semibold" />
        <AppText variant="bodySm" color={colors.canvas} style={styles.text}>
          {toast.message}
        </AppText>
      </Animated.View>
    </View>
  );
}

export function useToast(): ToastContextValue {
  const context = use(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>.');
  return context;
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: SPACE.lg, right: SPACE.lg, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
    borderRadius: RADIUS.lg,
    maxWidth: 520,
  },
  text: { flexShrink: 1 },
});
