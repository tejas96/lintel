'use client';

import { cn, easing, useCalmMotion } from '@lintel/design-system/web';
import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

const SEEN_PREFIX = 'lintel_reward_embossed_';

/** A scalloped rim like a notary seal: 30 lobes between two radii. */
function rosettePath(lobes: number, inner: number, outer: number, centre: number): string {
  const point = (angle: number, radius: number) =>
    `${(centre + radius * Math.cos(angle)).toFixed(2)} ${(centre + radius * Math.sin(angle)).toFixed(2)}`;
  const step = (Math.PI * 2) / lobes;
  const segments = Array.from({ length: lobes }, (_, index) => {
    const start = index * step;
    return `Q ${point(start + step / 2, outer)} ${point(start + step, inner)}`;
  });
  return `M ${point(0, inner)} ${segments.join(' ')} Z`;
}

const ROSETTE = rosettePath(30, 52, 58, 60);

function alreadyEmbossed(id: string): boolean {
  try {
    return window.localStorage.getItem(`${SEEN_PREFIX}${id}`) === '1';
  } catch {
    return true;
  }
}

function rememberEmbossed(id: string): void {
  try {
    window.localStorage.setItem(`${SEEN_PREFIX}${id}`, '1');
  } catch {
    // Without storage the seal simply presses again next time.
  }
}

interface RewardSealProps {
  /** The approved evaluation; its seal presses in once, the first time it is seen. */
  readonly evaluationId: string;
  /** Only the person rewarded sees the press; reviewers see the seal at rest. */
  readonly celebrate: boolean;
  readonly className?: string;
}

/**
 * A blind-embossed seal: the paper's own colour, read through light and
 * shadow. On first sight of an approved reward it presses into the page once;
 * after that (and under calm motion) it simply sits there.
 */
export function RewardSeal({ evaluationId, celebrate, className }: RewardSealProps) {
  // Storage is only readable in the browser, so the seal waits one frame to know.
  const [phase, setPhase] = useState<'unknown' | 'press' | 'still'>('unknown');
  // Decided once per mount, so a re-run effect (Strict Mode) never cancels the press.
  const decided = useRef<'press' | 'still' | null>(null);
  useEffect(() => {
    if (decided.current === null) {
      decided.current = !celebrate || alreadyEmbossed(evaluationId) ? 'still' : 'press';
      if (decided.current === 'press') rememberEmbossed(evaluationId);
    }
    setPhase(decided.current);
  }, [evaluationId, celebrate]);
  const pressing = phase === 'press';
  // Under calm motion the seal fades in where it rests: no press, no ripple.
  const calm = useCalmMotion();
  const entrance = calm ? { opacity: 0 } : { scale: 1.16, opacity: 0, rotate: -6 };
  return (
    <span aria-hidden className={cn('relative inline-flex size-28 shrink-0', className)}>
      {pressing && !calm && (
        <motion.span
          className="absolute inset-2 rounded-full border border-rule"
          initial={{ scale: 0.92, opacity: 0.7 }}
          animate={{ scale: 1.32, opacity: 0 }}
          transition={{ duration: 0.9, ease: easing('outQuint'), delay: 0.28 }}
        />
      )}
      {phase !== 'unknown' && (
        <motion.svg
          viewBox="0 0 120 120"
          className="lt-emboss size-full"
          initial={pressing ? entrance : false}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 240, damping: 17, mass: 0.9 }}
        >
          <path d={ROSETTE} className="fill-raised stroke-rule" strokeWidth={0.75} />
          <circle cx={60} cy={60} r={44} className="fill-none stroke-rule" strokeWidth={0.9} />
          <circle
            cx={60}
            cy={60}
            r={39}
            className="fill-none stroke-rule"
            strokeWidth={1.4}
            strokeDasharray="0.1 3.2"
            strokeLinecap="round"
          />
          <g className="stroke-rule" strokeWidth={3.2} strokeLinecap="round" fill="none">
            <path d="M40 49 H80" />
            <path d="M49 49 V75" />
            <path d="M71 49 V75" />
          </g>
          <path d="M44 81 H76" className="stroke-rule" strokeWidth={1} strokeLinecap="round" />
        </motion.svg>
      )}
    </span>
  );
}
