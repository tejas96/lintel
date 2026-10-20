import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { api, unwrap } from '@/api/api-client';
import { ApiError, errorMessage, fieldErrors } from '@/api/api-error';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { SPACE } from '@/theme/layout';
import { formatCountdown, useCountdown } from './use-countdown';

export interface PhoneNumberInput {
  readonly countryCallingCode: string;
  readonly nationalNumber: string;
}

export interface OtpRequested {
  readonly phone: PhoneNumberInput;
  readonly maskedPhone: string;
  readonly expiresInSeconds: number;
  readonly resendAvailableInSeconds: number;
}

export interface PhoneStepProps {
  readonly initialNationalNumber: string;
  readonly autoFocus: boolean;
  readonly onRequested: (result: OtpRequested) => void;
}

export function PhoneStep({ initialNationalNumber, autoFocus, onRequested }: PhoneStepProps) {
  const [countryCode, setCountryCode] = useState('+91');
  const [nationalNumber, setNationalNumber] = useState(initialNationalNumber);
  const rateLimit = useCountdown(0);
  const request = useMutation({
    mutationFn: (phone: PhoneNumberInput) => unwrap(api.auth.requestOtp({ body: phone })),
    onSuccess: (result, phone) => onRequested({ phone, ...result }),
    onError: (error) => {
      if (error instanceof ApiError && error.retryAfterSeconds) {
        rateLimit.start(error.retryAfterSeconds);
      }
    },
  });
  const digits = nationalNumber.replace(/\D/g, '');
  const errors = fieldErrors(request.error);
  const limited = rateLimit.remaining > 0;
  const generalError =
    request.error && !errors.nationalNumber && !errors.countryCallingCode
      ? limited
        ? `Too many requests. Try again in ${formatCountdown(rateLimit.remaining)}.`
        : errorMessage(request.error)
      : null;
  const submit = () => {
    if (digits.length < 6 || request.isPending || limited) return;
    request.mutate({ countryCallingCode: countryCode.trim(), nationalNumber: digits });
  };

  return (
    <View style={styles.step}>
      <View style={styles.row}>
        <View style={styles.code}>
          <TextField
            label="Code"
            value={countryCode}
            onChangeText={(text) => setCountryCode(`+${text.replace(/\D/g, '').slice(0, 4)}`)}
            keyboardType="phone-pad"
            autoComplete="tel-country-code"
            maxLength={5}
            error={errors.countryCallingCode ?? null}
          />
        </View>
        <View style={styles.number}>
          <TextField
            label="Mobile number"
            value={nationalNumber}
            onChangeText={setNationalNumber}
            placeholder="90000 00006"
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            autoComplete="tel-national"
            autoFocus={autoFocus}
            returnKeyType="go"
            onSubmitEditing={submit}
            maxLength={16}
            error={errors.nationalNumber ?? null}
          />
        </View>
      </View>
      {generalError ? (
        <AppText variant="bodySm" tone="secondary" accessibilityLiveRegion="polite">
          {generalError}
        </AppText>
      ) : null}
      <Button
        label={limited ? `Try again in ${formatCountdown(rateLimit.remaining)}` : 'Send code'}
        size="lg"
        onPress={submit}
        loading={request.isPending}
        disabled={digits.length < 6 || limited}
        accessibilityHint="Sends a 6-digit sign-in code by SMS"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  step: { gap: SPACE.lg },
  row: { flexDirection: 'row', gap: SPACE.sm, alignItems: 'flex-start' },
  code: { width: 84 },
  number: { flex: 1 },
});
