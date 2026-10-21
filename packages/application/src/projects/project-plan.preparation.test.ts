import { NO_TAILORING } from '@lintel/domain';
import { toCalendarDate } from '@lintel/shared';
import { describe, expect, it } from 'vitest';
import { describeTailoring } from './project-plan.preparation';

describe('describing a tailored plan', () => {
  it('says nothing when nothing changed', () => {
    expect(describeTailoring(NO_TAILORING)).toBeNull();
  });

  it('lists only what changed, in plain words', () => {
    expect(
      describeTailoring({
        ...NO_TAILORING,
        removedTaskKeys: ['a', 'b'],
        addedStages: [{ key: 'x', name: 'Site visit', afterStageKey: null }],
        adjustments: [
          { taskKey: 'c', startDate: toCalendarDate('2026-11-09') },
          { taskKey: 'd', ownerUserId: 'u1' },
        ],
      }),
    ).toBe('removed 2 tasks, added 1 stage, changed 1 date, chose people for 1 task');
  });
});
