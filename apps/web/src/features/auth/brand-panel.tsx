'use client';

import { pageEnter } from '@lintel/design-system/web';
import { motion } from 'motion/react';
import { BrandDrawing } from './brand-drawing';
import { Wordmark } from './brand-mark';

/**
 * The sign-in page's cyanotype sheet. On phones it shrinks to a band above
 * the form; on wide screens it fills the left half like a drawing on a board.
 */
export function BrandPanel() {
  return (
    <section
      aria-label="About Lintel"
      className="lt-blueprint-grid relative flex flex-col overflow-hidden text-on-blueprint md:min-h-dvh"
    >
      <div className="flex items-center justify-between px-6 pt-6 md:px-10 md:pt-9">
        <Wordmark />
        <p className="hidden type-mono text-on-blueprint-muted sm:block">Sheet A-001</p>
      </div>
      <div className="flex flex-1 items-center justify-center px-6 py-4 md:px-14 md:py-10">
        <BrandDrawing className="max-h-44 max-w-[30rem] md:max-h-none" />
      </div>
      <motion.div
        {...pageEnter}
        transition={{ ...pageEnter.transition, delay: 0.4 }}
        className="hidden flex-col gap-3 px-10 pb-10 md:flex"
      >
        <h2 className="max-w-md type-display-lg text-balance">Every project, drawn to scale.</h2>
        <p className="max-w-md type-body text-on-blueprint-muted">
          Stages, deadlines and the day’s work for your whole studio, in one calm place.
        </p>
        <dl className="mt-6 grid max-w-md grid-cols-3 border border-on-blueprint/25 type-body-sm">
          <div className="flex flex-col gap-0.5 border-r border-on-blueprint/25 px-3 py-2">
            <dt className="text-on-blueprint-muted">Drawn by</dt>
            <dd>Your studio</dd>
          </div>
          <div className="flex flex-col gap-0.5 border-r border-on-blueprint/25 px-3 py-2">
            <dt className="text-on-blueprint-muted">Scale</dt>
            <dd>1 : 1</dd>
          </div>
          <div className="flex flex-col gap-0.5 px-3 py-2">
            <dt className="text-on-blueprint-muted">Revision</dt>
            <dd>Today</dd>
          </div>
        </dl>
      </motion.div>
    </section>
  );
}
