/** "45 min", "2 h", "2 h 30 min" */
export function formatMinutes(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** Live timer for an active work session: "1:04:09". */
export function formatElapsed(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(rest).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${minutes}:${ss}`;
}

/** 3 half days → "1½" (the number only, for large numerals). */
export function formatHalfDayNumber(halfDays: number): string {
  const whole = Math.floor(halfDays / 2);
  const half = halfDays % 2 === 1;
  if (whole === 0 && half) return '½';
  return `${whole}${half ? '½' : ''}`;
}

/** Leave balances are counted in half days: 3 → "1½ days". */
export function formatHalfDays(halfDays: number): string {
  const whole = Math.floor(halfDays / 2);
  const half = halfDays % 2 === 1;
  if (whole === 0 && half) return '½ day';
  const label = `${whole}${half ? '½' : ''}`;
  return whole === 1 && !half ? '1 day' : `${label} days`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
