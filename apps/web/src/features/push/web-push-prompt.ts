/**
 * The Today prompt for browser notifications is offered once: after the person
 * answers it ("Turn on" or "Not now"), only the Account page offers web push.
 */
const PROMPT_KEY = 'lintel.web-push-prompt';

export type WebPushPromptAnswer = 'enabled' | 'later';

export function webPushPromptAnswer(): WebPushPromptAnswer | null {
  try {
    const value = window.localStorage.getItem(PROMPT_KEY);
    return value === 'enabled' || value === 'later' ? value : null;
  } catch {
    // Storage refused (private window): treat as answered, so the card never nags.
    return 'later';
  }
}

export function rememberWebPushPromptAnswer(answer: WebPushPromptAnswer): void {
  try {
    window.localStorage.setItem(PROMPT_KEY, answer);
  } catch {
    // Nothing to keep; the card is hidden for the rest of this visit anyway.
  }
}

/**
 * Offer only when web push is available but off here, and the browser has not
 * been asked yet (a granted or blocked browser is handled on the Account page).
 */
export function shouldOfferWebPush(input: {
  readonly state: string;
  readonly permission: NotificationPermission;
  readonly answer: WebPushPromptAnswer | null;
}): boolean {
  return input.state === 'off' && input.permission === 'default' && input.answer === null;
}
