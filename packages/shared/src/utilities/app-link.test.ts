import { describe, expect, it } from 'vitest';
import { appLink } from './app-link';

describe('links into the app', () => {
  it('joins the web address and the in-app path', () => {
    expect(appLink('https://studio.example.com', '/leave/abc')).toBe(
      'https://studio.example.com/leave/abc',
    );
  });

  it('falls back to Today for anything that is not a plain in-app path', () => {
    for (const unsafe of [null, '', 'https://evil.example', '//evil.example/x', '/\\evil', 'x']) {
      expect(appLink('https://studio.example.com', unsafe)).toBe(
        'https://studio.example.com/today',
      );
    }
  });
});
