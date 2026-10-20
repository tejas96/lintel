'use client';

import { cn, useCalmMotion } from '@lintel/design-system/web';
import { motion, useAnimate } from 'motion/react';
import { type ClipboardEvent, type KeyboardEvent, useEffect, useRef } from 'react';

interface OtpInputProps {
  readonly length?: number;
  readonly value: string;
  readonly onChange: (value: string) => void;
  /** Called once all digits are filled. */
  readonly onComplete: (code: string) => void;
  readonly invalid?: boolean;
  /** Increment to shake the boxes after a wrong code. */
  readonly shakeKey?: number;
  readonly disabled?: boolean;
  readonly describedBy?: string | undefined;
}

/**
 * One box per digit. Typing advances, Backspace goes back, arrow keys move,
 * and pasting (or SMS autofill into the first box) fills every box.
 */
export function OtpInput({
  length = 6,
  value,
  onChange,
  onComplete,
  invalid = false,
  shakeKey = 0,
  disabled = false,
  describedBy,
}: OtpInputProps) {
  const boxes = useRef<Array<HTMLInputElement | null>>([]);
  const [scope, animate] = useAnimate();
  const calm = useCalmMotion();
  const digits = Array.from({ length }, (_, index) => value[index] ?? '');

  useEffect(() => {
    boxes.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (shakeKey === 0 || calm || !scope.current) return;
    animate(scope.current, { x: [0, -8, 8, -5, 5, 0] }, { duration: 0.4 });
    boxes.current[0]?.focus();
  }, [shakeKey, calm, animate, scope]);

  const commit = (next: string, focusIndex: number) => {
    const clean = next.replace(/\D/g, '').slice(0, length);
    onChange(clean);
    boxes.current[Math.min(focusIndex, length - 1)]?.focus();
    if (clean.length === length) onComplete(clean);
  };

  const onType = (index: number, raw: string) => {
    let typed = raw.replace(/\D/g, '');
    const existing = digits[index];
    // Typing into a filled box keeps only the new digit.
    if (existing && typed.length === 2)
      typed = typed.startsWith(existing) ? typed.slice(1) : typed.slice(0, 1);
    if (!typed) return;
    // Autofill can deliver the whole code into one box.
    commit(
      `${value.slice(0, index)}${typed}${value.slice(index + typed.length)}`,
      index + typed.length,
    );
  };

  const onKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace') {
      event.preventDefault();
      const target = digits[index] ? index : Math.max(0, index - 1);
      commit(`${value.slice(0, target)}${value.slice(target + 1)}`, target);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      boxes.current[Math.max(0, index - 1)]?.focus();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      boxes.current[Math.min(length - 1, index + 1)]?.focus();
    }
  };

  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    commit(event.clipboardData.getData('text'), length - 1);
  };

  return (
    <fieldset
      ref={scope}
      className="m-0 flex min-w-0 gap-2 border-0 p-0 sm:gap-3"
      aria-describedby={describedBy}
    >
      <legend className="sr-only">Sign-in code</legend>
      {digits.map((digit, index) => (
        <motion.input
          // biome-ignore lint/suspicious/noArrayIndexKey: one box per digit position
          key={index}
          ref={(element) => {
            boxes.current[index] = element;
          }}
          aria-label={`Digit ${index + 1} of ${length}`}
          aria-invalid={invalid || undefined}
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          pattern="[0-9]*"
          maxLength={index === 0 ? length : 2}
          disabled={disabled}
          value={digit}
          onChange={(event) => onType(index, event.target.value)}
          onKeyDown={(event) => onKeyDown(index, event)}
          onPaste={onPaste}
          onFocus={(event) => event.target.select()}
          animate={{ scale: digit ? 1 : 0.98 }}
          className={cn(
            'size-12 rounded-md border bg-raised text-center font-display text-[1.75rem] leading-none text-ink tabular-nums sm:size-14',
            'transition-[border-color,box-shadow] duration-(--duration-fast) caret-accent',
            'focus-visible:border-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/20',
            invalid ? 'border-overdue' : digit ? 'border-ink-faint' : 'border-rule',
            'disabled:opacity-60',
          )}
        />
      ))}
    </fieldset>
  );
}
