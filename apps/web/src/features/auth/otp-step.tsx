'use client';

import type { CurrentUser } from '@lintel/api-contracts';
import { Button } from '@lintel/design-system/web';
import { useMutation } from '@tanstack/react-query';
import { CircleAlert } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useId, useState } from 'react';
import { api, expectStatus } from '@/lib/api/api-client';
import { isApiError } from '@/lib/api/api-error';
import { formatClock, useCountdown } from '@/lib/format/use-countdown';
import { SKIP_AUTH_REDIRECT } from '@/providers/query-client';
import { OtpInput } from './otp-input';
import type { CodeRequest } from './phone-step';

interface OtpStepProps {
  readonly request: CodeRequest;
  readonly onResent: (request: CodeRequest) => void;
  readonly onChangeNumber: () => void;
  readonly onVerified: (user: CurrentUser) => void;
}

export function OtpStep({ request, onResent, onChangeNumber, onVerified }: OtpStepProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const resend = useCountdown(request.resendAvailableInSeconds);
  const lockout = useCountdown();
  const messageId = useId();
  const phone = {
    countryCallingCode: request.countryCallingCode,
    nationalNumber: request.nationalNumber,
  };

  const verify = useMutation({
    meta: SKIP_AUTH_REDIRECT,
    mutationFn: (submitted: string) =>
      expectStatus(api.auth.verifyOtp({ body: { ...phone, code: submitted, client: 'web' } }), 200),
    onSuccess: (result) => onVerified(result.user),
    onError: (failure) => {
      setCode('');
      setShakeKey((key) => key + 1);
      if (isApiError(failure) && failure.status === 429) {
        lockout.start(failure.retryAfterSeconds ?? 60);
        setError('Too many attempts. Wait for the timer, then try again.');
      } else {
        setError(isApiError(failure) ? failure.message : 'Something went wrong. Please try again.');
      }
    },
  });

  const resendCode = useMutation({
    meta: SKIP_AUTH_REDIRECT,
    mutationFn: () => expectStatus(api.auth.requestOtp({ body: phone }), 200),
    onSuccess: (result) => {
      setError(null);
      setCode('');
      resend.start(result.resendAvailableInSeconds);
      onResent({ ...request, ...result });
    },
    onError: (failure) => {
      if (isApiError(failure) && failure.retryAfterSeconds) resend.start(failure.retryAfterSeconds);
      setError(
        isApiError(failure) ? failure.message : 'The code could not be sent. Please try again.',
      );
    },
  });

  const locked = lockout.remaining > 0;
  const submit = (submitted: string) => {
    if (locked || verify.isPending) return;
    setError(null);
    verify.mutate(submitted);
  };

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (code.length === 6) submit(code);
        else setError('Enter all 6 digits.');
      }}
    >
      <OtpInput
        value={code}
        onChange={(next) => {
          setCode(next);
          if (error && !locked) setError(null);
        }}
        onComplete={submit}
        invalid={Boolean(error)}
        shakeKey={shakeKey}
        disabled={verify.isPending || locked}
        describedBy={error ? messageId : undefined}
      />
      <AnimatePresence initial={false}>
        {error && (
          <motion.p
            id={messageId}
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="-mt-2 flex items-start gap-2 type-body-sm text-overdue"
          >
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>
              {error}
              {locked && (
                <span className="ml-1 font-medium tabular-nums">
                  {formatClock(lockout.remaining)}
                </span>
              )}
            </span>
          </motion.p>
        )}
      </AnimatePresence>
      <Button
        type="submit"
        variant="primary"
        size="lg"
        pending={verify.isPending}
        disabled={locked}
        className="w-full"
      >
        Sign in
      </Button>
      <div className="flex flex-wrap items-center justify-between gap-3 type-body-sm">
        <button
          type="button"
          onClick={onChangeNumber}
          className="min-h-11 rounded-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline"
        >
          Use a different number
        </button>
        {resend.remaining > 0 ? (
          <span className="text-ink-faint tabular-nums">
            New code in {formatClock(resend.remaining)}
          </span>
        ) : (
          <Button
            variant="quiet"
            size="sm"
            pending={resendCode.isPending}
            onClick={() => resendCode.mutate()}
          >
            Send a new code
          </Button>
        )}
      </div>
    </form>
  );
}
