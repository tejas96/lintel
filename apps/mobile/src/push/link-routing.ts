import type { Href } from 'expo-router';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

interface LinkRule {
  readonly pattern: RegExp;
  readonly toHref: (id: string) => Href;
}

/**
 * Server links (`linkPath` on notifications and approvals) are web paths. Each
 * rule maps one to the screen that shows the same record in the app.
 */
const RULES: readonly LinkRule[] = [
  {
    pattern: new RegExp(`^/tasks/(${UUID})`, 'i'),
    toHref: (id) => ({ pathname: '/tasks/[id]', params: { id } }),
  },
  {
    pattern: new RegExp(`^/deliverables/(${UUID})`, 'i'),
    toHref: (id) => ({ pathname: '/deliverables/[id]', params: { id } }),
  },
  {
    pattern: new RegExp(`^/leave(?:/requests)?/(${UUID})`, 'i'),
    toHref: (id) => ({ pathname: '/leave/[id]', params: { id } }),
  },
  {
    pattern: new RegExp(`^/projects/(${UUID})`, 'i'),
    toHref: (id) => ({ pathname: '/projects/[id]', params: { id } }),
  },
];

const SECTION_RULES: readonly { readonly pattern: RegExp; readonly href: Href }[] = [
  { pattern: /^\/approvals/i, href: '/approvals' },
  { pattern: /^\/leave/i, href: '/leave' },
  { pattern: /^\/notifications/i, href: '/inbox' },
  { pattern: /^\/projects\/?$/i, href: '/projects' },
  { pattern: /^\/(today|work|me)?\/?$/i, href: '/' },
];

/** The in-app destination for a server link, or null when the app has no such screen. */
export function hrefForLinkPath(linkPath: string | null | undefined): Href | null {
  if (!linkPath) return null;
  const path = (linkPath.split(/[?#]/)[0] ?? '').trim();
  for (const rule of RULES) {
    const id = rule.pattern.exec(path)?.[1];
    if (id) return rule.toHref(id.toLowerCase());
  }
  return SECTION_RULES.find((rule) => rule.pattern.test(path))?.href ?? null;
}
