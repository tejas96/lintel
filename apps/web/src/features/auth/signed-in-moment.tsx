'use client';

import type { CurrentUser } from '@lintel/api-contracts';
import { easing } from '@lintel/design-system/web';
import { motion } from 'motion/react';

/** A short confirmation while the studio loads: the tick draws, then we go in. */
export function SignedInMoment({ user }: { readonly user: CurrentUser }) {
  const firstName = user.fullName.split(' ')[0] ?? user.fullName;
  return (
    <div role="status" className="flex flex-col items-start gap-5">
      <svg viewBox="0 0 48 48" aria-hidden className="size-12 text-accent">
        <motion.circle
          cx={24}
          cy={24}
          r={21}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, ease: easing('outQuint') }}
        />
        <motion.path
          d="M15 24.5 21.5 31 33.5 17.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.35, delay: 0.35, ease: easing('outQuint') }}
        />
      </svg>
      <div className="flex flex-col gap-2">
        <h1 className="type-display-lg text-ink">Welcome back, {firstName}</h1>
        <p className="type-body text-ink-muted">Opening {user.organizationName}…</p>
      </div>
    </div>
  );
}
