import { describe, expect, it } from 'vitest';
import { toCalendarDate } from './calendar-date';
import { calendarDateInTimeZone, isValidTimeZone, zonedTimeToInstant } from './time-zone';

describe('time zones', () => {
  it('finds the local calendar date for an instant', () => {
    const instant = new Date('2026-10-21T20:00:00Z');
    expect(calendarDateInTimeZone(instant, 'Asia/Kolkata')).toBe('2026-10-22');
    expect(calendarDateInTimeZone(instant, 'America/New_York')).toBe('2026-10-21');
  });

  it('converts a local wall-clock time to UTC', () => {
    const instant = zonedTimeToInstant(toCalendarDate('2026-10-21'), '18:30', 'Asia/Kolkata');
    expect(instant.toISOString()).toBe('2026-10-21T13:00:00.000Z');
  });

  it('handles daylight-saving zones', () => {
    const summer = zonedTimeToInstant(toCalendarDate('2026-07-01'), '09:00', 'Europe/London');
    const winter = zonedTimeToInstant(toCalendarDate('2026-12-01'), '09:00', 'Europe/London');
    expect(summer.toISOString()).toBe('2026-07-01T08:00:00.000Z');
    expect(winter.toISOString()).toBe('2026-12-01T09:00:00.000Z');
  });

  it('validates timezone names', () => {
    expect(isValidTimeZone('Asia/Kolkata')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
  });
});
