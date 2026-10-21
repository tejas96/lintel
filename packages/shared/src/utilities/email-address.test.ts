import { describe, expect, it } from 'vitest';
import { maskEmailAddress } from './email-address';

describe('email address masking', () => {
  it('keeps the first letter and the domain only', () => {
    expect(maskEmailAddress('ananya.joshi@studio.example')).toBe('a•••@studio.example');
  });

  it('never echoes something that is not an address', () => {
    expect(maskEmailAddress('not-an-address')).toBe('•••');
    expect(maskEmailAddress('@example.com')).toBe('•••');
    expect(maskEmailAddress('someone@')).toBe('•••');
  });
});
