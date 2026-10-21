/** Which first-run tips a person has already seen (one row per person and tip). */
export interface GuidanceStore {
  seenTipKeys(userId: string): Promise<string[]>;
  /** Idempotent: seeing a tip twice keeps the first time. */
  markSeen(userId: string, tipKey: string, at: Date): Promise<void>;
  /** Forgets every tip the person has seen, so they show again. */
  forget(userId: string): Promise<void>;
}
