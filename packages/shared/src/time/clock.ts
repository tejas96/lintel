/** Source of the current time. Inject it so time-dependent rules stay testable. */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

/** A clock that always returns the same instant. Intended for tests. */
export function fixedClock(instant: Date | string): Clock {
  const fixed = new Date(instant);
  return { now: () => new Date(fixed.getTime()) };
}
