/**
 * Outcome of handing one SMS or email to a provider. Reasons are safe,
 * mapped text (never a provider's raw response, a phone number or an address).
 */
export type MessageSendResult =
  | { readonly outcome: 'sent'; readonly providerMessageId: string | null }
  /** Network trouble, rate limits, provider outages: the worker retries with backoff. */
  | { readonly outcome: 'retryable_failure'; readonly reason: string }
  /** Rejected for good (bad credentials, template, recipient): recorded as failed. */
  | { readonly outcome: 'permanent_failure'; readonly reason: string }
  /** A development adapter recorded the message instead of sending it: recorded as skipped. */
  | { readonly outcome: 'not_configured'; readonly reason: string };
