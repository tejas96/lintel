'use client';

import { Input } from '@lintel/design-system/web';
import { type ReactNode, useEffect, useState } from 'react';

interface IntegerInputProps {
  /** The current whole number, or undefined when the field is empty and optional. */
  readonly value: number | undefined;
  /** Called with each valid whole number typed; undefined when an optional field is cleared. */
  readonly onValueChange: (value: number | undefined) => void;
  readonly optional?: boolean;
  readonly disabled?: boolean;
  readonly trailing?: ReactNode;
  readonly className?: string;
}

/**
 * A whole-number field that lets people clear and retype freely: half-typed
 * text stays on screen, only whole numbers reach the definition, and leaving
 * the field shows the number that was kept.
 */
export function IntegerInput({
  value,
  onValueChange,
  optional = false,
  disabled,
  trailing,
  className,
}: IntegerInputProps) {
  const [text, setText] = useState(value === undefined ? '' : String(value));
  useEffect(() => {
    setText(value === undefined ? '' : String(value));
  }, [value]);
  return (
    <Input
      inputMode="numeric"
      value={text}
      disabled={disabled}
      className={className}
      {...(trailing ? { trailing } : {})}
      onChange={(event) => {
        const next = event.target.value;
        setText(next);
        if (next.trim() === '') {
          if (optional) onValueChange(undefined);
          return;
        }
        if (/^\d{1,6}$/.test(next.trim())) onValueChange(Number(next.trim()));
      }}
      onBlur={() => setText(value === undefined ? '' : String(value))}
    />
  );
}
