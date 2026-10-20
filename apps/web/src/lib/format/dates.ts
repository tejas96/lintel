/**
 * Date wording for the studio. Calendar dates ("2026-10-21") are business
 * dates with no time zone; instants are ISO timestamps shown in the studio's
 * time zone.
 */
const DAY_MS = 86_400_000;

function dayNumber(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return Math.round(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1) / DAY_MS);
}

export function daysBetween(from: string, to: string): number {
  return dayNumber(to) - dayNumber(from);
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(key: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  let existing = formatters.get(key);
  if (!existing) {
    existing = new Intl.DateTimeFormat('en-IN', options);
    formatters.set(key, existing);
  }
  return existing;
}

const asUtcNoon = (date: string) => new Date(`${date}T12:00:00Z`);

/** "21 Oct" (adds the year when it differs from `today`). */
export function formatCalendarDate(date: string, today?: string): string {
  const sameYear = !today || today.slice(0, 4) === date.slice(0, 4);
  return sameYear
    ? formatter('dm', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(asUtcNoon(date))
    : formatter('dmy', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
        asUtcNoon(date),
      );
}

/** "Wednesday 21 October". */
export function formatLongDate(date: string): string {
  return formatter('long', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(asUtcNoon(date));
}

/** "Due today", "Due tomorrow", "Due in 4 days", "2 days late", "Due Mon 3 Nov". */
export function describeDue(
  dueDate: string,
  today: string,
): { text: string; late: boolean; soon: boolean } {
  const days = daysBetween(today, dueDate);
  if (days < 0) {
    const late = Math.abs(days);
    return { text: `${late} ${late === 1 ? 'day' : 'days'} late`, late: true, soon: false };
  }
  if (days === 0) return { text: 'Due today', late: false, soon: true };
  if (days === 1) return { text: 'Due tomorrow', late: false, soon: true };
  if (days < 7) return { text: `Due in ${days} days`, late: false, soon: false };
  const label = formatter('wdm', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(asUtcNoon(dueDate));
  return { text: `Due ${label}`, late: false, soon: false };
}

/** Today's calendar date in a time zone. */
export function todayIn(timeZone: string): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

const RELATIVE = new Intl.RelativeTimeFormat('en-IN', { numeric: 'auto' });

/** "just now", "5 minutes ago", "yesterday", then a date. */
export function formatRelativeInstant(instant: string, now: number = Date.now()): string {
  const seconds = Math.round((new Date(instant).getTime() - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return 'just now';
  if (abs < 3600) return RELATIVE.format(Math.round(seconds / 60), 'minute');
  if (abs < 86_400) return RELATIVE.format(Math.round(seconds / 3600), 'hour');
  if (abs < 7 * 86_400) return RELATIVE.format(Math.round(seconds / 86_400), 'day');
  return formatter('dm-instant', { day: 'numeric', month: 'short' }).format(new Date(instant));
}

/** "2h 30m", "45m", "0m". */
export function formatMinutes(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = Math.round(total % 60);
  if (hours === 0) return `${minutes}m`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

/** Morning / afternoon / evening greeting for the studio's local time. */
export function greetingFor(timeZone: string): string {
  const hour = Number(
    formatter(`hour-${timeZone}`, { hour: 'numeric', hourCycle: 'h23', timeZone }).format(
      new Date(),
    ),
  );
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
