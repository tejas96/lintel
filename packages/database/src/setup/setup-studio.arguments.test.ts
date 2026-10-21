import { describe, expect, it } from 'vitest';
import {
  parseSetupArguments,
  referencePrefixFor,
  SetupArgumentsError,
} from './setup-studio.arguments';

const required = [
  '--studio-name',
  'Saffron Design Studio',
  '--owner-name',
  'Meera Rao',
  '--owner-phone',
  '+91 98123 45678',
];

function problemsOf(run: () => unknown): readonly string[] {
  try {
    run();
  } catch (error) {
    if (error instanceof SetupArgumentsError) return error.problems;
    throw error;
  }
  throw new Error('Expected the arguments to be refused.');
}

describe('setup arguments', () => {
  it('reads flags, fills defaults and normalises the phone like sign-in does', () => {
    expect(parseSetupArguments(['--', ...required], {})).toEqual({
      studioName: 'Saffron Design Studio',
      ownerName: 'Meera Rao',
      ownerPhoneE164: '+919812345678',
      ownerEmail: null,
      timeZone: 'Asia/Kolkata',
      currency: 'INR',
      projectReferencePrefix: 'SDS',
    });
  });

  it('accepts --flag=value, environment fallbacks and a national number', () => {
    const input = parseSetupArguments(['--owner-phone=098123 45678', '--currency=inr'], {
      LINTEL_STUDIO_NAME: 'Saffron',
      LINTEL_OWNER_NAME: 'Meera Rao',
      LINTEL_OWNER_EMAIL: 'meera@saffron.example',
      LINTEL_REFERENCE_PREFIX: 'saf',
      LINTEL_TIMEZONE: 'Asia/Dubai',
    });
    expect(input).toMatchObject({
      ownerPhoneE164: '+919812345678',
      ownerEmail: 'meera@saffron.example',
      currency: 'INR',
      projectReferencePrefix: 'SAF',
      timeZone: 'Asia/Dubai',
    });
  });

  it('reports every problem at once, by flag', () => {
    const problems = problemsOf(() =>
      parseSetupArguments(['--timezone', 'India/Mumbai', '--currency', 'RUPEES'], {}),
    );
    expect(problems).toEqual([
      '--studio-name is required.',
      '--owner-name is required.',
      '--owner-phone is required.',
      '--timezone must be an IANA time zone such as Asia/Kolkata.',
      '--currency must be a three-letter ISO code such as INR.',
    ]);
  });

  it('refuses unknown options, missing values and a mismatched country code', () => {
    expect(problemsOf(() => parseSetupArguments(['--studio', 'X'], {}))).toEqual([
      'Unknown option --studio.',
    ]);
    expect(problemsOf(() => parseSetupArguments(['--owner-name'], {}))).toEqual([
      '--owner-name needs a value.',
    ]);
    const foreign = ['--studio-name', 'S', '--owner-name', 'M', '--owner-phone', '+44 7700 900123'];
    expect(problemsOf(() => parseSetupArguments([...foreign], {}))).toContain(
      '--studio-name needs at least 2 characters.',
    );
    const mismatch = [...required.slice(0, 4), '--owner-phone', '+44 7700 900123'];
    expect(problemsOf(() => parseSetupArguments(mismatch, {}))[0]).toMatch(
      /different country code than 91/,
    );
    expect(
      parseSetupArguments([...mismatch, '--owner-country-code', '44'], {}).ownerPhoneE164,
    ).toBe('+447700900123');
  });

  it('derives a reference prefix from the studio name', () => {
    expect(referencePrefixFor('Aranya Design Studio')).toBe('ADS');
    expect(referencePrefixFor('Lintel')).toBe('LIN');
    expect(referencePrefixFor('A')).toBe('PRJ');
    expect(referencePrefixFor('Studio of Light and Stone Works Ltd')).toBe('SOLAS');
  });
});
