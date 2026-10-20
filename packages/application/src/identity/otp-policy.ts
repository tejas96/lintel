/** Sign-in limits. Values come from validated configuration. */
export interface OtpPolicy {
  readonly codeLength: number;
  readonly expiryMinutes: number;
  readonly maxVerifyAttempts: number;
  readonly resendCooldownSeconds: number;
  readonly requestsPerPhonePerHour: number;
  readonly requestsPerIpPerHour: number;
  readonly verificationsPerPhonePerQuarterHour: number;
  readonly verificationsPerIpPerQuarterHour: number;
  readonly webSessionDays: number;
  readonly mobileSessionDays: number;
}

export const DEFAULT_OTP_POLICY: OtpPolicy = {
  codeLength: 6,
  expiryMinutes: 5,
  maxVerifyAttempts: 5,
  resendCooldownSeconds: 30,
  requestsPerPhonePerHour: 5,
  requestsPerIpPerHour: 30,
  verificationsPerPhonePerQuarterHour: 10,
  verificationsPerIpPerQuarterHour: 60,
  webSessionDays: 30,
  mobileSessionDays: 90,
};
