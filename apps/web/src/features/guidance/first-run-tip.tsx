'use client';

import { IconButton, layoutSpring } from '@lintel/design-system/web';
import { Compass, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { type GuidanceTipKey, useGuidance, useMarkTipSeen } from './use-guidance';

/**
 * A short, role-specific tip the first time someone opens a screen. It is
 * marked seen as soon as it shows (so it never returns on any device) and
 * stays for this visit until dismissed. It sits in the flow of the page and
 * never covers or blocks work.
 */
export function FirstRunTip({
  tip,
  className,
}: {
  readonly tip: GuidanceTipKey;
  readonly className?: string;
}) {
  const guidance = useGuidance();
  const markSeen = useMarkTipSeen();
  const content = guidance.data?.tips.find((candidate) => candidate.key === tip);
  // Decided once per visit: whether this screen greets the person with its tip.
  // Seeded from the server render, so it is usually known on the first render: no late shift.
  const [showing, setShowing] = useState<boolean | null>(() => (content ? !content.seen : null));
  const marked = useRef(false);

  useEffect(() => {
    if (showing !== null || !content) return;
    setShowing(!content.seen);
  }, [content, showing]);

  useEffect(() => {
    if (!showing || marked.current) return;
    marked.current = true;
    markSeen.mutate(tip);
  }, [showing, markSeen, tip]);

  const titleId = `first-run-tip-${tip}`;
  return (
    <AnimatePresence initial={false}>
      {showing && content && (
        <motion.section
          key={tip}
          aria-labelledby={titleId}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={layoutSpring}
          className={className ? `overflow-hidden ${className}` : 'overflow-hidden'}
        >
          <div className="relative flex gap-3 rounded-lg border border-accent/25 bg-accent-soft/50 py-3.5 pr-12 pl-4">
            <Compass aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
            <div className="flex min-w-0 flex-col gap-1">
              <p className="type-label text-accent">First time here</p>
              <h2 id={titleId} className="type-title-md text-ink">
                {content.title}
              </h2>
              <p className="max-w-2xl type-body-sm text-ink-muted">{content.body}</p>
            </div>
            <IconButton
              label="Dismiss this tip"
              size="sm"
              variant="quiet"
              onClick={() => setShowing(false)}
              className="absolute top-2 right-2"
            >
              <X aria-hidden className="size-4" />
            </IconButton>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
