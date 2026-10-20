import { randomUUID } from 'node:crypto';

/**
 * Object keys never contain user-supplied names, so they cannot be used for
 * path tricks or reveal client names. The original name lives in the database.
 */
export function generateObjectKey(
  scope: string,
  extension: string,
  now: Date = new Date(),
): string {
  const safeScope = scope.replace(/[^a-z0-9-]/gi, '').slice(0, 40) || 'files';
  const safeExtension = extension
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 8)
    .toLowerCase();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${safeScope}/${year}/${month}/${randomUUID()}${safeExtension ? `.${safeExtension}` : ''}`;
}

/** For Content-Disposition headers: strips quotes, slashes and control characters. */
export function safeDownloadName(originalName: string): string {
  const cleaned = [...originalName]
    .filter((character) => character.charCodeAt(0) >= 32 && !'"\\/'.includes(character))
    .join('')
    .trim();
  return cleaned.slice(0, 150) || 'download';
}
