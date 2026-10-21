/** Only plain in-app paths ("/tasks/…"); "//host", "\\host" or full URLs never leave the app. */
const IN_APP_PATH = /^\/(?![/\\])[^\\\s]*$/;

/**
 * Absolute link into the web app for a notification's in-app path, used in
 * SMS, emails and web push. Anything that is not a plain path opens Today.
 */
export function appLink(webBaseUrl: string, linkPath: string | null): string {
  const path = linkPath && IN_APP_PATH.test(linkPath) ? linkPath : '/today';
  return new URL(path, webBaseUrl).toString();
}
