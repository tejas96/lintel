/**
 * Delivers a one-time code the application generated. Verification happens
 * in the application against a stored hash, so every provider shares the
 * same expiry, attempt and abuse rules.
 */
export interface OtpProvider {
  readonly name: string;
  /** True only for the local development provider. Production must reject it. */
  readonly isDevelopmentOnly: boolean;
  sendCode(request: OtpDeliveryRequest): Promise<OtpDeliveryResult>;
}

export interface OtpDeliveryRequest {
  readonly phoneE164: string;
  readonly code: string;
  readonly expiresInMinutes: number;
}

export type OtpDeliveryResult =
  | { readonly delivered: true; readonly providerReference: string | null }
  | { readonly delivered: false; readonly retryable: boolean; readonly reason: string };
