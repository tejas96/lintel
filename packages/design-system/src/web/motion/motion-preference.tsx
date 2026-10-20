'use client';

import { MotionConfig, useReducedMotion } from 'motion/react';
import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { DURATION, EASING } from '../../tokens/motion';

interface MotionPreference {
  /** The in-app "Calm motion" setting. */
  readonly calm: boolean;
  readonly setCalm: (calm: boolean) => void;
}

const MotionPreferenceContext = createContext<MotionPreference>({
  calm: false,
  setCalm: () => undefined,
});

interface MotionPreferenceProviderProps {
  readonly calm: boolean;
  readonly onCalmChange: (calm: boolean) => void;
  readonly children: ReactNode;
}

/**
 * Shares the "Calm motion" preference and configures Motion so transforms and
 * layout animations stop under the OS reduced-motion setting or Calm motion.
 * Opacity fades remain, because they carry meaning without movement.
 */
export function MotionPreferenceProvider({
  calm,
  onCalmChange,
  children,
}: MotionPreferenceProviderProps) {
  const value = useMemo(() => ({ calm, setCalm: onCalmChange }), [calm, onCalmChange]);
  return (
    <MotionPreferenceContext.Provider value={value}>
      <MotionConfig
        reducedMotion={calm ? 'always' : 'user'}
        transition={{ duration: DURATION.base / 1000, ease: [...EASING.standard] }}
      >
        {children}
      </MotionConfig>
    </MotionPreferenceContext.Provider>
  );
}

export function useMotionPreference(): MotionPreference {
  return useContext(MotionPreferenceContext);
}

/** True when movement should be avoided (OS reduced motion or Calm motion). */
export function useCalmMotion(): boolean {
  const systemReduced = useReducedMotion();
  const { calm } = useContext(MotionPreferenceContext);
  return calm || systemReduced === true;
}
