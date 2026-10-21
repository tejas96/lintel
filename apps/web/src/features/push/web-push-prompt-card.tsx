'use client';

import { Button, layoutSpring, useToast } from '@lintel/design-system/web';
import { BellRing } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useWebPush } from './use-web-push';
import {
  rememberWebPushPromptAnswer,
  shouldOfferWebPush,
  type WebPushPromptAnswer,
  webPushPromptAnswer,
} from './web-push-prompt';

/**
 * Asks for browser notifications in context — on Today, once, after the
 * person has seen their work — never on page load: the browser's own prompt
 * only appears after "Turn on". Hidden when the studio has no Firebase web
 * configuration, the browser cannot receive pushes, or it was already asked.
 */
export function WebPushPromptCard() {
  const toast = useToast();
  const { state, working, enable } = useWebPush();
  // undefined until read on the client, so the server render never shows the card.
  const [answer, setAnswer] = useState<WebPushPromptAnswer | null | undefined>(undefined);

  useEffect(() => {
    setAnswer(webPushPromptAnswer());
  }, []);

  const offered =
    answer !== undefined &&
    state === 'off' &&
    shouldOfferWebPush({ state, permission: Notification.permission, answer });

  const answerWith = (value: WebPushPromptAnswer) => {
    rememberWebPushPromptAnswer(value);
    setAnswer(value);
  };

  const turnOn = async () => {
    const outcome = await enable();
    if (outcome === 'on') answerWith('enabled');
    if (outcome === 'declined') {
      answerWith('later');
      toast({
        tone: 'info',
        title: 'Notifications are off',
        description: 'You can turn them on in Account at any time.',
      });
    }
  };

  return (
    <AnimatePresence initial={false}>
      {offered && (
        <motion.section
          key="web-push-prompt"
          aria-labelledby="web-push-prompt-title"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={layoutSpring}
          className="overflow-hidden"
        >
          <div className="flex flex-col gap-3 rounded-lg border border-accent/25 bg-accent-soft/60 p-4 sm:flex-row sm:items-start">
            <BellRing aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
            <div className="flex flex-1 flex-col gap-1.5">
              <h2 id="web-push-prompt-title" className="type-title-md text-ink">
                Hear about changes as they happen
              </h2>
              <p className="type-body-sm text-ink-muted">
                Lintel can tell you on this computer when work is assigned to you, a review comes
                back, something you’re waiting on is unblocked, or leave is decided. Your quiet
                hours are respected, and your browser asks first.
              </p>
            </div>
            <div className="flex shrink-0 gap-2 self-start">
              <Button size="sm" variant="primary" pending={working} onClick={() => void turnOn()}>
                Turn on
              </Button>
              <Button
                size="sm"
                variant="quiet"
                disabled={working}
                onClick={() => answerWith('later')}
              >
                Not now
              </Button>
            </div>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
