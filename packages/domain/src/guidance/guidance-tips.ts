import type { Capability } from '../identity/capabilities';

/** Screens that greet a person with a short tip the first time they open them. */
export const GUIDANCE_TIP_KEYS = [
  'today',
  'task',
  'control_room',
  'leave',
  'command_center',
] as const;
export type GuidanceTipKey = (typeof GUIDANCE_TIP_KEYS)[number];

/** Who a tip speaks to: someone doing the work, someone running it, or the studio's owner. */
export type GuidanceAudience = 'member' | 'manager' | 'owner';

export interface GuidanceTip {
  readonly key: GuidanceTipKey;
  readonly title: string;
  readonly body: string;
}

type TipText = Pick<GuidanceTip, 'title' | 'body'>;

/** The audience follows what the person may do, so a changed role changes the words. */
export function guidanceAudienceFor(capabilities: ReadonlySet<Capability>): GuidanceAudience {
  if (capabilities.has('dashboard.view_business')) return 'owner';
  if (
    capabilities.has('projects.create') ||
    capabilities.has('tasks.assign') ||
    capabilities.has('leave.approve_team')
  ) {
    return 'manager';
  }
  return 'member';
}

const TIPS: Readonly<Record<GuidanceTipKey, Partial<Record<GuidanceAudience, TipText>>>> = {
  today: {
    member: {
      title: 'Your day, in order',
      body: 'The top card is what to do next, and why. The list below is ranked by deadline, priority and who is waiting on you.',
    },
    manager: {
      title: 'Your day, in order',
      body: 'Your own work comes first, ranked by deadline and who waits on you. Reviews waiting for you sit beside it.',
    },
    owner: {
      title: 'Your day, in order',
      body: 'Your own tasks and reviews live here. For the whole studio, open the command center.',
    },
  },
  task: {
    member: {
      title: 'Everything for one task',
      body: 'Move it on with the buttons at the top. Report a blocker as soon as you hit one: your manager hears at once.',
    },
    manager: {
      title: 'Everything for one task',
      body: 'Edit changes the owner, dates or reviewer. Moving a committed date asks for a reason and stays in the history.',
    },
  },
  control_room: {
    member: {
      title: 'Your project in one place',
      body: 'See the plan on Timeline and your team’s work on Board. Ask your project manager when a date needs to move.',
    },
    manager: {
      title: 'Run the project from here',
      body: 'Overview shows health and risks. Drag bars on Timeline to reschedule; Scope keeps changes the client agreed to.',
    },
  },
  leave: {
    member: {
      title: 'Ask for time off',
      body: 'Pick the days and Lintel shows any deadline you would miss before you send it. Leave is never refused automatically.',
    },
    manager: {
      title: 'Leave and its impact',
      body: 'Requests from your team show what they would affect. Decide them here, and propose handovers for work that cannot wait.',
    },
  },
  command_center: {
    manager: {
      title: 'Your projects at a glance',
      body: 'Start with what needs attention. Every number opens the records behind it, and filters stay in the address to share.',
    },
    owner: {
      title: 'The studio at a glance',
      body: 'Start with what needs attention. Every number opens the records behind it, and filters stay in the address to share.',
    },
  },
};

/** The tip for this screen and audience, or null when the screen has none for them. */
export function guidanceTipFor(
  key: GuidanceTipKey,
  audience: GuidanceAudience,
): GuidanceTip | null {
  const byAudience = TIPS[key];
  const text = byAudience[audience] ?? (audience === 'owner' ? byAudience.manager : undefined);
  return text ? { key, ...text } : null;
}

export function isGuidanceTipKey(value: string): value is GuidanceTipKey {
  return (GUIDANCE_TIP_KEYS as readonly string[]).includes(value);
}
