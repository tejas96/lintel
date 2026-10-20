import type { CurrentUser } from '@lintel/api-contracts';
import type { Capability } from '@lintel/domain';

export function can(user: CurrentUser, capability: Capability): boolean {
  return user.capabilities.includes(capability);
}

const DECISION_CAPABILITIES: readonly Capability[] = [
  'deliverables.review',
  'leave.approve_team',
  'leave.approve_any',
  'tasks.manage_any',
  'scope_changes.approve',
];

/** People whose job includes deciding on other people's work or leave. */
export function makesDecisions(user: CurrentUser): boolean {
  return DECISION_CAPABILITIES.some((capability) => can(user, capability));
}

export type AppTab = 'index' | 'site' | 'projects' | 'approvals' | 'leave' | 'inbox';

/**
 * Tabs follow capabilities, not role names, so a studio that changes its role
 * mapping gets the right app. At most five tabs; site updates move into each
 * project's page for people who also make decisions.
 */
export function visibleTabs(user: CurrentUser): ReadonlySet<AppTab> {
  const tabs = new Set<AppTab>(['index', 'projects', 'inbox']);
  const decides = makesDecisions(user);
  if (decides) tabs.add('approvals');
  if (can(user, 'site_updates.create') && !decides) tabs.add('site');
  if (can(user, 'leave.request')) tabs.add('leave');
  return tabs;
}
