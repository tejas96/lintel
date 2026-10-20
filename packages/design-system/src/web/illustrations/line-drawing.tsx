'use client';

import { motion } from 'motion/react';
import { cn } from '../lib/cn';
import { useCalmMotion } from '../motion/motion-preference';
import { easing } from '../motion/presets';
import { DRAWINGS, type DrawingName } from './drawings';

interface LineDrawingProps {
  readonly name: DrawingName;
  readonly className?: string;
  /** Draw the strokes in sequence on first appearance. */
  readonly animate?: boolean;
}

/** Decorative line art; hidden from assistive technology. */
export function LineDrawing({ name, className, animate = true }: LineDrawingProps) {
  const calm = useCalmMotion();
  const strokes = DRAWINGS[name];
  const draw = animate && !calm;
  return (
    <svg
      viewBox="0 0 160 120"
      aria-hidden
      focusable="false"
      className={cn('h-auto w-40 text-ink-faint', className)}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {strokes.map((stroke, index) => {
        const delay = 0.1 + index * 0.09;
        // Motion draws paths with a dash array, so dashed strokes fade in instead.
        if (stroke.dashed) {
          return (
            <motion.path
              // biome-ignore lint/suspicious/noArrayIndexKey: strokes are a fixed drawing
              key={index}
              d={stroke.d}
              stroke="currentColor"
              strokeWidth={stroke.accent ? 1.5 : 1.25}
              strokeDasharray="3 3"
              className={stroke.accent ? 'text-accent' : undefined}
              initial={draw ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: delay + 0.4 }}
            />
          );
        }
        return (
          <motion.path
            // biome-ignore lint/suspicious/noArrayIndexKey: strokes are a fixed drawing
            key={index}
            d={stroke.d}
            stroke="currentColor"
            strokeWidth={stroke.accent ? 1.5 : 1.25}
            className={stroke.accent ? 'text-accent' : undefined}
            initial={draw ? { pathLength: 0, opacity: 0 } : false}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{
              pathLength: { duration: 0.9, ease: easing('inOut'), delay },
              opacity: { duration: 0.2, delay },
            }}
          />
        );
      })}
    </svg>
  );
}
