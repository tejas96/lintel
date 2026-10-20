import { describe, expect, it } from 'vitest';
import { createTimelineScale } from './timeline-scale';

describe('timeline scale', () => {
  it('pads the range to whole weeks starting on a Monday', () => {
    const scale = createTimelineScale('2026-10-21', '2026-10-30', 'week');
    // 2026-10-21 is a Wednesday: the week starts on the 19th, plus one week of padding.
    expect(scale.start).toBe('2026-10-12');
    expect(new Date(`${scale.end}T00:00:00Z`).getUTCDay()).toBe(0);
  });

  it('places dates by whole days', () => {
    const scale = createTimelineScale('2026-10-21', '2026-10-30', 'week');
    expect(scale.x('2026-10-13') - scale.x('2026-10-12')).toBe(scale.dayWidth);
    expect(scale.width).toBe(scale.ticks.length * scale.dayWidth);
  });

  it('labels Mondays in week zoom and month starts in month zoom', () => {
    const weeks = createTimelineScale('2026-10-21', '2026-11-20', 'week');
    expect(
      weeks.ticks.filter((tick) => tick.label).every((tick) => tick.gridline === 'major'),
    ).toBe(true);
    const months = createTimelineScale('2026-10-21', '2026-12-20', 'month');
    expect(months.ticks.filter((tick) => tick.label).map((tick) => tick.date)).toEqual([
      '2026-11-01',
      '2026-12-01',
    ]);
  });
});
