/**
 * A partial update as it arrives from validated input: a key may be missing
 * or explicitly undefined. `null` is a real value ("clear this field").
 */
export type Patch<T> = { [K in keyof T]?: T[K] | undefined };

/** Drops keys whose value is undefined, so only provided fields are written. */
export function definedOnly<T extends object>(patch: Patch<T>): Partial<T> {
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}
