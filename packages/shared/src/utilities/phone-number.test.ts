import { describe, expect, it } from 'vitest';
import { maskPhoneNumber, toPhoneNumberE164 } from './phone-number';

describe('phone numbers', () => {
  it('normalises typed Indian mobile numbers to E.164', () => {
    expect(toPhoneNumberE164('91', '98765 43210')).toBe('+919876543210');
    expect(toPhoneNumberE164('+91', '098765-43210')).toBe('+919876543210');
    expect(toPhoneNumberE164('91', '+91 98765 43210')).toBe('+919876543210');
  });

  it('rejects numbers that cannot be E.164', () => {
    expect(toPhoneNumberE164('91', '123')).toBeNull();
    expect(toPhoneNumberE164('0', '9876543210')).toBeNull();
  });

  it('masks all but the last four digits', () => {
    expect(maskPhoneNumber('+919876543210')).toBe('+91 •••••• 3210');
  });
});
