import { useMutation } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance, View } from 'react-native';
import { api, unwrap } from '@/api/api-client';
import { ApiError, errorMessage } from '@/api/api-error';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { haptics } from '@/feedback/haptics';
import { useSession } from '@/session/session-provider';
import { SPACE } from '@/theme/layout';
import { OtpCodeInput } from './otp-code-input';
import type { OtpRequested } from './phone-step';
import { formatCountdown, useCountdown } from './use-countdown';

const CODE_LENGTH = 6;

export interface CodeStepProps {
  readonly request: OtpRequested;
  readonly onResent: (request: OtpRequested) => void;
  readonly onChangeNumber: () => void;
}

export function CodeStep({ request, onResent, onChangeNumber }: CodeStepProps) {
  const { completeSignIn } = useSession();
  const [code, setCode] = useState('');
  const [failures, setFailures] = useState(0);
  const inputRef = useRef<TextInputInstance>(null);
  const resend = useCountdown(request.resendAvailableInSeconds);
  const lockout = useCountdown(0);

  const verify = useMutation({
    mutationFn: (submitted: string) =>
      unwrap(api.auth.verifyOtp({ body: { ...request.phone, code: submitted, client: 'mobile' } })),
    onSuccess: async ({ sessionToken, user }) => {
      if (!sessionToken) throw new Error('The server did not return a mobile session.');
      haptics.success();
      await completeSignIn(sessionToken, user);
    },
    onError: (error) => {
      haptics.error();
      setFailures((count) => count + 1);
      setCode('');
      if (error instanceof ApiError && error.retryAfterSeconds)
        lockout.start(error.retryAfterSeconds);
      inputRef.current?.focus();
    },
  });

  const resendCode = useMutation({
    mutationFn: () => unwrap(api.auth.requestOtp({ body: request.phone })),
    onSuccess: (result) => {
      resend.start(result.resendAvailableInSeconds);
      setCode('');
      verify.reset();
      onResent({ phone: request.phone, ...result });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.retryAfterSeconds)
        resend.start(error.retryAfterSeconds);
    },
  });

  const locked = lockout.remaining > 0;
  const message = locked
    ? `Too many attempts. Try again in ${formatCountdown(lockout.remaining)}.`
    : verify.error
      ? errorMessage(verify.error)
      : resendCode.error
        ? errorMessage(resendCode.error)
        : null;

  return (
    <View style={styles.step}>
      <OtpCodeInput
        ref={inputRef}
        value={code}
        length={CODE_LENGTH}
        onChange={(next) => {
          setCode(next);
          if (verify.isError) verify.reset();
        }}
        onComplete={(complete) => {
          if (!locked && !verify.isPending) verify.mutate(complete);
        }}
        hasError={verify.isError}
        errorCount={failures}
        disabled={verify.isPending || locked}
      />
      {message ? (
        <AppText variant="bodySm" tone="secondary" accessibilityLiveRegion="assertive">
          {message}
        </AppText>
      ) : null}
      <Button
        label="Sign in"
        size="lg"
        onPress={() => verify.mutate(code)}
        loading={verify.isPending}
        disabled={code.length !== CODE_LENGTH || locked}
      />
      <View style={styles.links}>
        <Button
          label={
            resend.remaining > 0
              ? `Resend code in ${formatCountdown(resend.remaining)}`
              : 'Resend code'
          }
          variant="quiet"
          onPress={() => resendCode.mutate()}
          loading={resendCode.isPending}
          disabled={resend.remaining > 0}
        />
        <Button label="Use a different number" variant="quiet" onPress={onChangeNumber} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  step: { gap: SPACE.lg },
  links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
});
