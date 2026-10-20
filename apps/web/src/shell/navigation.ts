import type { Capability } from '@lintel/domain';
import {
  Award,
  CalendarRange,
  DraftingCompass,
  Gauge,
  type LucideIcon,
  ScrollText,
  SlidersHorizontal,
  Stamp,
  Sun,
  Users,
  Waypoints,
  Workflow,
} from 'lucide-react';

export interface NavItem {
  readonly id: string;
  readonly label: string;
  /** Shorter name for the phone tab bar, when the full one would wrap. */
  readonly shortLabel?: string;
  readonly href: string;
  readonly icon: LucideIcon;
  /** Shown when the person holds any of these; everyone when empty. */
  readonly requires: readonly Capability[];
  /**
   * Whether this screen exists in the web app yet. Entries for screens owned
   * by later work stay here, hidden, so the menu never shows a dead link.
   */
  readonly built: boolean;
}

/** One navigation for every role; capabilities decide what each person sees. */
export const NAV_ITEMS: readonly NavItem[] = [
  { id: 'today', label: 'Today', href: '/today', icon: Sun, requires: [], built: true },
  {
    id: 'projects',
    label: 'Projects',
    href: '/projects',
    icon: DraftingCompass,
    requires: [],
    built: true,
  },
  {
    id: 'command-center',
    label: 'Command center',
    shortLabel: 'Studio',
    href: '/command-center',
    icon: Gauge,
    requires: ['dashboard.view_business'],
    built: true,
  },
  {
    id: 'approvals',
    label: 'Approvals',
    href: '/approvals',
    icon: Stamp,
    requires: [],
    built: true,
  },
  {
    id: 'capacity',
    label: 'Capacity',
    href: '/capacity',
    icon: Waypoints,
    requires: ['capacity.view_team', 'capacity.view_all'],
    built: true,
  },
  {
    id: 'leave',
    label: 'Leave',
    href: '/leave',
    icon: CalendarRange,
    requires: ['leave.request'],
    built: true,
  },
  {
    id: 'rewards',
    label: 'Rewards',
    href: '/rewards',
    icon: Award,
    requires: ['rewards.view_own', 'rewards.view_all'],
    built: true,
  },
  {
    id: 'templates',
    label: 'Templates',
    href: '/templates',
    icon: Workflow,
    requires: ['templates.manage'],
    built: true,
  },
  {
    id: 'people',
    label: 'People',
    href: '/people',
    icon: Users,
    requires: ['users.view_directory'],
    built: true,
  },
  {
    id: 'settings',
    label: 'Settings',
    href: '/settings',
    icon: SlidersHorizontal,
    requires: ['organization.manage_settings', 'roles.manage'],
    built: true,
  },
  {
    id: 'audit',
    label: 'Audit log',
    shortLabel: 'Audit',
    href: '/audit',
    icon: ScrollText,
    requires: ['audit.view'],
    built: true,
  },
];

export function visibleNavItems(can: (...capabilities: Capability[]) => boolean): NavItem[] {
  return NAV_ITEMS.filter(
    (item) => item.built && (item.requires.length === 0 || can(...item.requires)),
  );
}

/** The nav entry that owns a path (longest matching prefix). */
export function activeNavId(pathname: string, items: readonly NavItem[]): string | null {
  const match = items
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((left, right) => right.href.length - left.href.length)[0];
  if (match) return match.id;
  if (pathname.startsWith('/tasks/')) return 'today';
  return null;
}
