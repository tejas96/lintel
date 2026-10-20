import { describe, expect, it } from 'vitest';
import { CryptoRandomSource, FixedCodeRandomSource, HmacSecretHasher } from './node-crypto';

describe('crypto helpers', () => {
  const hasher = new HmacSecretHasher('a'.repeat(32));

  it('produces keyed hashes that verify only the original value', () => {
    const hash = hasher.hash('482913');
    expect(hash).not.toContain('482913');
    expect(hasher.matches('482913', hash)).toBe(true);
    expect(hasher.matches('482914', hash)).toBe(false);
  });

  it('rejects short secrets', () => {
    expect(() => new HmacSecretHasher('short')).toThrow(RangeError);
  });

  it('generates numeric codes and long tokens', () => {
    const random = new CryptoRandomSource();
    expect(random.numericCode(6)).toMatch(/^\d{6}$/);
    expect(random.token().length).toBeGreaterThanOrEqual(43);
    expect(new FixedCodeRandomSource('123456').numericCode(6)).toBe('123456');
  });
});
