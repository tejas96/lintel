'use client';

import { Button } from '@lintel/design-system/web';
import { RotateCw } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useState } from 'react';
import { isApiError } from '@/lib/api/api-error';

/**
 * Remembers that a change was refused because someone else saved first
 * (409 STALE_VERSION), so the screen can ask the person to refresh instead
 * of retrying blindly with an old version.
 */
export function useStaleVersion() {
  const [stale, setStale] = useState(false);
  /** True (and flags the screen) when the error is a stale-version refusal. */
  const catchStale = useCallback((error: unknown): boolean => {
    if (isApiError(error) && error.isStaleVersion) {
      setStale(true);
      return true;
    }
    return false;
  }, []);
  const clear = useCallback(() => setStale(false), []);
  return { stale, catchStale, clear };
}

interface StaleVersionNoticeProps {
  readonly show: boolean;
  readonly onRefresh: () => void;
  readonly refreshing?: boolean;
  /** What changed, in the screen's words. */
  readonly message?: string;
}

/** An inline prompt to load the latest version before trying again. */
export function StaleVersionNotice({
  show,
  onRefresh,
  refreshing = false,
  message = 'Someone else changed this while you were looking. Refresh to see the latest version, then decide again.',
}: StaleVersionNoticeProps) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          role="alert"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <div className="flex flex-col gap-3 rounded-md border border-at-risk-solid/40 bg-at-risk-tint/60 p-3.5 sm:flex-row sm:items-center">
            <p className="flex-1 type-body-sm text-ink">{message}</p>
            <Button
              size="sm"
              variant="secondary"
              pending={refreshing}
              leadingIcon={<RotateCw aria-hidden />}
              onClick={onRefresh}
              className="self-start sm:self-auto"
            >
              Refresh
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
