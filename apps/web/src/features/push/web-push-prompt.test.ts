import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  rememberWebPushPromptAnswer,
  shouldOfferWebPush,
  webPushPromptAnswer,
} from './web-push-prompt';

function stubStorage(): Map<string, string> {
  const values = new Map<string, string>();
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
  return values;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('web push prompt on Today', () => {
  it('is offered only while push is off here and the browser has not asked yet', () => {
    expect(shouldOfferWebPush({ state: 'off', permission: 'default', answer: null })).toBe(true);
    expect(shouldOfferWebPush({ state: 'off', permission: 'granted', answer: null })).toBe(false);
    expect(shouldOfferWebPush({ state: 'blocked', permission: 'denied', answer: null })).toBe(
      false,
    );
    expect(shouldOfferWebPush({ state: 'hidden', permission: 'default', answer: null })).toBe(
      false,
    );
    expect(shouldOfferWebPush({ state: 'on', permission: 'granted', answer: null })).toBe(false);
  });

  it('is not offered again once answered', () => {
    stubStorage();
    expect(webPushPromptAnswer()).toBeNull();
    rememberWebPushPromptAnswer('later');
    const answer = webPushPromptAnswer();
    expect(answer).toBe('later');
    expect(shouldOfferWebPush({ state: 'off', permission: 'default', answer })).toBe(false);
  });

  it('ignores unknown stored values', () => {
    stubStorage().set('lintel.web-push-prompt', 'maybe');
    expect(webPushPromptAnswer()).toBeNull();
  });

  it('stays quiet when the browser refuses storage', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new Error('SecurityError');
        },
        setItem: () => {
          throw new Error('SecurityError');
        },
      },
    });
    expect(webPushPromptAnswer()).toBe('later');
    expect(() => rememberWebPushPromptAnswer('enabled')).not.toThrow();
  });
});
