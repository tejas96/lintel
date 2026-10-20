'use client';

import { Button, Field, Input, Select } from '@lintel/design-system/web';
import { useMutation } from '@tanstack/react-query';
import { MessageSquareText } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { api, expectStatus } from '@/lib/api/api-client';
import { isApiError } from '@/lib/api/api-error';
import { formatClock, useCountdown } from '@/lib/format/use-countdown';
import { SKIP_AUTH_REDIRECT } from '@/providers/query-client';

export interface CodeRequest {
  readonly countryCallingCode: string;
  readonly nationalNumber: string;
  readonly maskedPhone: string;
  readonly expiresInSeconds: number;
  readonly resendAvailableInSeconds: number;
}

const COUNTRY_CODES = [
  { value: '+91', label: '+91', description: 'India' },
  { value: '+971', label: '+971', description: 'United Arab Emirates' },
  { value: '+44', label: '+44', description: 'United Kingdom' },
  { value: '+1', label: '+1', description: 'United States, Canada' },
  { value: '+65', label: '+65', description: 'Singapore' },
  { value: '+61', label: '+61', description: 'Australia' },
] as const;

type CountryCode = (typeof COUNTRY_CODES)[number]['value'];

/** "9000000001" → "90000 00001" for Indian numbers; other countries stay as typed. */
function formatNational(country: CountryCode, digits: string): string {
  if (country !== '+91') return digits;
  return digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5, 10)}` : digits;
}

export function PhoneStep({ onCodeSent }: { readonly onCodeSent: (request: CodeRequest) => void }) {
  const [country, setCountry] = useState<CountryCode>('+91');
  const [digits, setDigits] = useState('');
  const [error, setError] = useState<string | null>(null);
  const cooldown = useCountdown();

  const requestCode = useMutation({
    meta: SKIP_AUTH_REDIRECT,
    mutationFn: (body: { countryCallingCode: string; nationalNumber: string }) =>
      expectStatus(api.auth.requestOtp({ body }), 200),
    onSuccess: (result, body) => onCodeSent({ ...body, ...result }),
    onError: (failure) => {
      if (isApiError(failure) && failure.status === 429 && failure.retryAfterSeconds) {
        cooldown.start(failure.retryAfterSeconds);
        setError('A code was sent a moment ago. You can ask for another when the timer ends.');
        return;
      }
      if (isApiError(failure)) {
        setError(failure.fieldErrors().nationalNumber ?? failure.message);
        return;
      }
      setError('Something went wrong. Please try again.');
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (digits.length < 6) {
      setError('Enter your full mobile number.');
      return;
    }
    setError(null);
    requestCode.mutate({ countryCallingCode: country, nationalNumber: digits });
  };

  const waiting = cooldown.remaining > 0;
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <Field label="Mobile number" hint="The number your studio registered for you." error={error}>
        <div className="flex gap-2">
          <div className="w-28 shrink-0">
            <Select
              label="Country code"
              value={country}
              onValueChange={setCountry}
              options={COUNTRY_CODES}
            />
          </div>
          <Input
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder={country === '+91' ? '98765 43210' : 'Mobile number'}
            value={formatNational(country, digits)}
            onChange={(event) => setDigits(event.target.value.replace(/\D/g, '').slice(0, 15))}
            className="font-medium tracking-[0.02em] tabular-nums"
          />
        </div>
      </Field>
      <Button
        type="submit"
        variant="primary"
        size="lg"
        pending={requestCode.isPending}
        disabled={waiting}
        leadingIcon={<MessageSquareText aria-hidden />}
        className="w-full"
      >
        {waiting ? `Send code again in ${formatClock(cooldown.remaining)}` : 'Text me a code'}
      </Button>
    </form>
  );
}
