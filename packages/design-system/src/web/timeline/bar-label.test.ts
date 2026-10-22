import { describe, expect, it } from 'vitest';
import { ganttBarLabel } from './bar-label';

describe('task bar label', () => {
  it('names a one-day bar once, in the singular', () => {
    const label = ganttBarLabel('Present the concept', 'Ready', '2026-10-29', '2026-10-29');
    expect(label).toMatch(/^Present the concept, Ready, 29 Oct, 1 day$/);
  });

  it('gives a longer bar its range and day count', () => {
    const label = ganttBarLabel('Working drawings', 'Ready', '2026-10-30', '2026-11-06');
    expect(label).toMatch(/, 30 Oct – 6 Nov, 8 days$/);
  });
});
