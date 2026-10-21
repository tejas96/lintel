import type { CommandCenterBriefing } from '@lintel/api-contracts';

type ComponentKey = CommandCenterBriefing['health']['components'][number]['key'];

/** The five parts of the score, in plain words. */
export const COMPONENT_NAMES: Readonly<Record<ComponentKey, string>> = {
  delivery_risk: 'Delivery risk',
  overdue_work: 'Overdue work',
  blocked_work: 'Blocked work',
  decisions_waiting: 'Decisions waiting',
  capacity_strain: 'Capacity strain',
};

/** How each part is measured and when it takes its whole weight (docs §15.1). */
export const COMPONENT_RULES: Readonly<Record<ComponentKey, string>> = {
  delivery_risk:
    'Off-track projects count fully, at-risk ones half, of all active projects. Full at 50 %.',
  overdue_work: 'Open tasks past their due date, of all open tasks. Full at 20 %.',
  blocked_work: 'Open tasks that are blocked, of all open tasks. Full at 10 %.',
  decisions_waiting:
    'Reviews, leave, scope changes, handovers and new dates waiting more than 2 days. Full at 5.',
  capacity_strain:
    'People above 105 % of their available time this week, of everyone in view. Full at 25 %.',
};
