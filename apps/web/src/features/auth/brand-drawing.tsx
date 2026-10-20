'use client';

import { cn, easing, useCalmMotion } from '@lintel/design-system/web';
import { motion } from 'motion/react';
import { ELEVATION_LABELS, ELEVATION_STROKES } from './brand-drawing-strokes';

const WEIGHTS = { heavy: 2, light: 1.1, hairline: 0.9 } as const;

/** The sign-in panel's drawing. It draws itself once; calm motion shows it finished. */
export function BrandDrawing({ className }: { readonly className?: string }) {
  const calm = useCalmMotion();
  return (
    <svg
      viewBox="0 0 520 420"
      aria-hidden
      focusable="false"
      className={cn('h-auto w-full text-on-blueprint', className)}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ELEVATION_STROKES.map((stroke) => {
        const width = WEIGHTS[stroke.weight ?? 'light'];
        const muted = stroke.weight === 'hairline';
        if (stroke.dashed) {
          return (
            <motion.path
              key={stroke.d}
              d={stroke.d}
              stroke="currentColor"
              strokeWidth={width}
              strokeDasharray="4 5"
              className={muted ? 'text-on-blueprint-muted' : undefined}
              initial={calm ? false : { opacity: 0 }}
              animate={{ opacity: 0.7 }}
              transition={{ duration: 0.8, delay: stroke.at }}
            />
          );
        }
        return (
          <motion.path
            key={stroke.d}
            d={stroke.d}
            stroke="currentColor"
            strokeWidth={width}
            className={muted ? 'text-on-blueprint-muted' : undefined}
            initial={calm ? false : { pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: muted ? 0.8 : 1 }}
            transition={{
              pathLength: { duration: 1.1, ease: easing('inOut'), delay: stroke.at },
              opacity: { duration: 0.15, delay: stroke.at },
            }}
          />
        );
      })}
      {ELEVATION_LABELS.map((label) => (
        <motion.text
          key={label.text}
          x={label.x}
          y={label.y}
          textAnchor="middle"
          dominantBaseline="middle"
          transform={label.vertical ? `rotate(-90 ${label.x} ${label.y})` : undefined}
          className="fill-on-blueprint-muted font-mono text-[11px] tracking-[0.04em]"
          initial={calm ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: label.at }}
        >
          {label.text}
        </motion.text>
      ))}
    </svg>
  );
}
