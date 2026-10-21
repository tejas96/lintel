import { describe, expect, it } from 'vitest';
import {
  challengeRefusal,
  correctionProblem,
  MAX_CHALLENGES_PER_RECORD,
} from './reward-challenge.rules';

const settled = (status: string, grantedAmountMinor: number | null = null) => ({
  status,
  grantedAmountMinor,
});

describe('raising a challenge', () => {
  const base = { isSubject: true, hasOpenChallenge: false, challengesSoFar: 0 };

  it('is open to the person once the outcome is known', () => {
    for (const status of ['ineligible', 'approved', 'rejected']) {
      expect(challengeRefusal({ ...base, record: settled(status) })).toBeNull();
    }
  });

  it('is refused to anyone else, before the outcome, twice at once or too often', () => {
    expect(challengeRefusal({ ...base, isSubject: false, record: settled('rejected') })).toContain(
      'Only the person',
    );
    expect(challengeRefusal({ ...base, record: settled('pending_review') })).toContain(
      'once the outcome is known',
    );
    expect(challengeRefusal({ ...base, record: settled('planned') })).not.toBeNull();
    expect(
      challengeRefusal({ ...base, hasOpenChallenge: true, record: settled('rejected') }),
    ).toContain('already waiting');
    expect(
      challengeRefusal({
        ...base,
        challengesSoFar: MAX_CHALLENGES_PER_RECORD,
        record: settled('rejected'),
      }),
    ).toContain('3 times');
  });
});

describe('correcting a record', () => {
  it('may grant a reward that was not granted, including a zero-amount recognition', () => {
    expect(correctionProblem(settled('rejected'), 250_000)).toBeNull();
    expect(correctionProblem(settled('ineligible'), 0)).toBeNull();
  });

  it('may only raise an approved amount, never lower or repeat it', () => {
    expect(correctionProblem(settled('approved', 300_000), 350_000)).toBeNull();
    expect(correctionProblem(settled('approved', 300_000), 300_000)).toContain('only raise');
    expect(correctionProblem(settled('approved', 300_000), 100_000)).toContain('only raise');
  });

  it('refuses amounts that are not whole, negative, too large or for unsettled records', () => {
    expect(correctionProblem(settled('rejected'), -1)).not.toBeNull();
    expect(correctionProblem(settled('rejected'), 10.5)).not.toBeNull();
    expect(correctionProblem(settled('rejected'), 100_000_001)).toBe('That amount is too large.');
    expect(correctionProblem(settled('pending_review'), 100)).toContain('no longer settled');
  });
});
