import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, { FadeInRight, FadeOutLeft, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/app-text';
import { BrandLockup } from '@/components/brand-mark';
import { Icon } from '@/components/icon';
import { readSecure, STORAGE_KEYS, writeSecure } from '@/session/secure-storage';
import { useSession } from '@/session/session-provider';
import { useAppTheme } from '@/theme/app-theme';
import { GUTTER, MAX_CONTENT_WIDTH, RADIUS, SPACE } from '@/theme/layout';
import { CodeStep } from './code-step';
import { type OtpRequested, PhoneStep } from './phone-step';

const stepEntering = FadeInRight.springify().damping(26).reduceMotion(ReduceMotion.System);
const stepExiting = FadeOutLeft.duration(140).reduceMotion(ReduceMotion.System);

/** Phone number, then a 6-digit code. Two screens' worth of work in one calm page. */
export function SignInScreen() {
  const { state } = useSession();
  const { colors, status } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [request, setRequest] = useState<OtpRequested | null>(null);
  const [lastNumber, setLastNumber] = useState<string | null>(null);

  useEffect(() => {
    void readSecure(STORAGE_KEYS.lastPhone).then((value) => setLastNumber(value ?? ''));
  }, []);

  const notice = state.status === 'signedOut' ? state.notice : null;

  return (
    <KeyboardAwareScrollView
      bottomOffset={SPACE.xl}
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: colors.canvas }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + SPACE.xxxl, paddingBottom: insets.bottom + SPACE.xl },
      ]}
    >
      <View style={styles.column}>
        <BrandLockup />
        <View style={styles.heading}>
          <AppText variant="displayLg">
            {request ? 'Check your messages' : 'Good to see you'}
          </AppText>
          <AppText variant="body" tone="secondary">
            {request
              ? `We sent a 6-digit code to ${request.maskedPhone}. It expires in ${Math.round(request.expiresInSeconds / 60)} minutes.`
              : 'Sign in with the mobile number your studio added you with.'}
          </AppText>
        </View>

        {notice ? (
          <View
            accessibilityRole="alert"
            style={[styles.notice, { backgroundColor: status.atRisk.tint }]}
          >
            <Icon name="info" size={16} color={status.atRisk.fg} />
            <AppText variant="bodySm" color={status.atRisk.fg} style={styles.noticeText}>
              {notice}
            </AppText>
          </View>
        ) : null}

        {lastNumber === null ? null : request ? (
          <Animated.View key="code" entering={stepEntering} exiting={stepExiting}>
            <CodeStep
              request={request}
              onResent={setRequest}
              onChangeNumber={() => setRequest(null)}
            />
          </Animated.View>
        ) : (
          <Animated.View key="phone" entering={stepEntering} exiting={stepExiting}>
            <PhoneStep
              initialNationalNumber={lastNumber}
              autoFocus={state.status === 'signedOut'}
              onRequested={(result) => {
                void writeSecure(STORAGE_KEYS.lastPhone, result.phone.nationalNumber);
                setRequest(result);
              }}
            />
          </Animated.View>
        )}
      </View>
      <AppText variant="bodySm" tone="tertiary" align="center" style={styles.footer}>
        Lintel is for studio members. Ask your studio admin if your number isn’t recognised.
      </AppText>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: GUTTER, justifyContent: 'space-between' },
  column: { gap: SPACE.xxl, width: '100%', maxWidth: MAX_CONTENT_WIDTH - 200, alignSelf: 'center' },
  heading: { gap: SPACE.sm, marginTop: SPACE.xl },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    padding: SPACE.md,
    borderRadius: RADIUS.md,
  },
  noticeText: { flex: 1 },
  footer: { marginTop: SPACE.xxxl, maxWidth: 320, alignSelf: 'center' },
});
