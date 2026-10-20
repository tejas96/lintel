'use client';

import type { CurrentUser } from '@lintel/api-contracts';
import { swapEnter } from '@lintel/design-system/web';
import { Info } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { OtpStep } from './otp-step';
import { type CodeRequest, PhoneStep } from './phone-step';
import { SignedInMoment } from './signed-in-moment';

type Step =
  | { readonly name: 'phone' }
  | { readonly name: 'code'; readonly request: CodeRequest }
  | { readonly name: 'done'; readonly user: CurrentUser };

interface SignInFlowProps {
  readonly returnTo: string;
  readonly sessionEnded: boolean;
}

/** Phone → code → signed in. Each step slides in from the direction of travel. */
export function SignInFlow({ returnTo, sessionEnded }: SignInFlowProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ name: 'phone' });
  const direction = step.name === 'phone' ? -1 : 1;

  const heading =
    step.name === 'phone'
      ? { title: 'Sign in', body: 'We’ll text a 6-digit code to your phone. No password needed.' }
      : step.name === 'code'
        ? {
            title: 'Enter your code',
            body: `Sent to ${step.request.maskedPhone}. It works for ${Math.round(step.request.expiresInSeconds / 60)} minutes.`,
          }
        : null;

  return (
    <div className="flex w-full max-w-[25rem] flex-col gap-8">
      {sessionEnded && step.name === 'phone' && (
        <p className="flex items-start gap-2.5 rounded-md border border-hairline bg-raised p-3 type-body-sm text-ink-muted">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
          Your session ended. Sign in again to pick up where you left off.
        </p>
      )}
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <motion.div key={step.name} {...swapEnter(direction)} className="flex flex-col gap-8">
          {heading && (
            <header className="flex flex-col gap-2">
              <h1 className="type-display-lg text-ink">{heading.title}</h1>
              <p className="type-body text-ink-muted">{heading.body}</p>
            </header>
          )}
          {step.name === 'phone' && (
            <PhoneStep onCodeSent={(request) => setStep({ name: 'code', request })} />
          )}
          {step.name === 'code' && (
            <OtpStep
              request={step.request}
              onResent={(request) => setStep({ name: 'code', request })}
              onChangeNumber={() => setStep({ name: 'phone' })}
              onVerified={(user) => {
                setStep({ name: 'done', user });
                window.setTimeout(() => {
                  router.replace(returnTo);
                  router.refresh();
                }, 900);
              }}
            />
          )}
          {step.name === 'done' && <SignedInMoment user={step.user} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
