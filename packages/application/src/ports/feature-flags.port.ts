/** Read-only feature switches resolved from validated configuration at startup. */
export interface FeatureFlags {
  /** Always false in Phase 1. See docs/AI_PHASE_TWO.md. */
  readonly aiFeaturesEnabled: boolean;
  readonly smsNotificationsEnabled: boolean;
}
