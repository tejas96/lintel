import type { Href } from 'expo-router';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

interface LinkRule {
  readonly pattern: RegExp;
  readonly toHref: (id: string, query: string) => Href;
}

/** The raw value of one query parameter when it matches `allowed`, else null. */
function queryValue(query: string, key: string, allowed: RegExp): string | null {
  const value = new RegExp(`(?:^|&)${key}=([^&]*)`).exec(query)?.[1] ?? null;
  return value !== null && allowed.test(value) ? value : null;
}

/**
 * A task link may say why it was sent: the late-start nudge
 * (`?nudge=late-start`) or a new-date request (`?dateRequest=<id>`). The task
 * screen highlights that part; anything else in the query is dropped.
 */
function taskHref(id: string, query: string): Href {
  const nudge = queryValue(query, 'nudge', /^late-start$/);
  const dateRequest = queryValue(query, 'dateRequest', new RegExp(`^${UUID}$`, 'i'));
  return {
    pathname: '/tasks/[id]',
    params: {
      id,
      ...(nudge ? { nudge } : {}),
      ...(dateRequest ? { dateRequest: dateRequest.toLowerCase() } : {}),
    },
  };
}

/**
 * Server links (`linkPath` on notifications and approvals) are web paths. Each
 * rule maps one to the screen that shows the same record in the app.
 */
const RULES: readonly LinkRule[] = [
  {
    pattern: new RegExp(`^/tasks/(${UUID})`, 'i'),
    toHref: taskHref,
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
  const [path = '', query = ''] = linkPath.trim().split('#')[0]?.split('?') ?? [];
  for (const rule of RULES) {
    const id = rule.pattern.exec(path)?.[1];
    if (id) return rule.toHref(id.toLowerCase(), query);
  }
  return SECTION_RULES.find((rule) => rule.pattern.test(path))?.href ?? null;
}
