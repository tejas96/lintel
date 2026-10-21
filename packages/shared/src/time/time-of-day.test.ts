import { describe, expect, it } from 'vitest';
import { compareTimesOfDay, isTimeOfDay, timeOfDayInTimeZone } from './time-of-day';

describe('time of day', () => {
  it('accepts 24-hour HH:mm only', () => {
    expect(isTimeOfDay('00:00')).toBe(true);
    expect(isTimeOfDay('11:05')).toBe(true);
    expect(isTimeOfDay('23:59')).toBe(true);
    expect(isTimeOfDay('24:00')).toBe(false);
    expect(isTimeOfDay('9:30')).toBe(false);
    expect(isTimeOfDay('11:60')).toBe(false);
    expect(isTimeOfDay('11:00:00')).toBe(false);
  });

  it('reads the local wall-clock time of an instant', () => {
    const instant = new Date('2026-10-21T05:30:00Z');
    expect(timeOfDayInTimeZone(instant, 'Asia/Kolkata')).toBe('11:00');
    expect(timeOfDayInTimeZone(instant, 'UTC')).toBe('05:30');
  });

  it('orders times', () => {
    expect(compareTimesOfDay('09:30', '11:00')).toBe(-1);
    expect(compareTimesOfDay('18:30', '11:00')).toBe(1);
    expect(compareTimesOfDay('11:00', '11:00')).toBe(0);
  });
});
