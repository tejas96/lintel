'use client';

import { useCallback, useState } from 'react';

type FieldErrors = Readonly<Record<string, string>>;

/**
 * Field errors for a form. Nothing is flagged while someone is still typing;
 * once a save has shown errors, they update with every change, so a fixed
 * field clears straight away instead of waiting for the next save.
 */
export function useFieldErrors<TValues>(check: (values: TValues) => Record<string, string>) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [checking, setChecking] = useState(false);
  /** Checks before saving; true when nothing needs fixing. */
  const validate = (values: TValues): boolean => {
    const found = check(values);
    setErrors(found);
    setChecking(true);
    return Object.keys(found).length === 0;
  };
  /** Call with the new values on every change. */
  const recheck = (values: TValues): void => {
    if (checking) setErrors(check(values));
  };
  const showServerErrors = useCallback((found: FieldErrors) => {
    setErrors(found);
    setChecking(true);
  }, []);
  const clear = useCallback(() => {
    setErrors({});
    setChecking(false);
  }, []);
  return { errors, validate, recheck, showServerErrors, clear };
}
