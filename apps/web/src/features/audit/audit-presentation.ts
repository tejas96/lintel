/** What each kind of record is called on screen. */
export const ENTITY_LABELS: Readonly<Record<string, string>> = {
  project: 'Project',
  task: 'Task',
  milestone: 'Milestone',
  deliverable: 'Deliverable',
  scope_change: 'Scope change',
  priority_conflict: 'Priority conflict',
  leave_request: 'Leave request',
  leave_handover: 'Handover',
  reward_policy: 'Reward policy',
  reward_evaluation: 'Reward',
  workflow_template: 'Template',
  user: 'Person',
  role: 'Role',
  organization: 'Studio settings',
  holiday: 'Holiday',
  session: 'Sign-in',
  device_token: 'Device',
  file: 'File',
};

export function entityLabel(entityType: string): string {
  return ENTITY_LABELS[entityType] ?? humanize(entityType);
}

/** "handover_accepted" → "Handover accepted". */
function humanize(text: string): string {
  const words = text.replace(/[_.]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * "leave.approve" → "Approve", "template.draft_saved" → "Draft saved": the
 * verb part of an action, since the record type is shown beside it.
 */
export function actionLabel(action: string): string {
  const [, ...rest] = action.split('.');
  return humanize(rest.length > 0 ? rest.join(' ') : action);
}

/** A field name as words: "ownerUserId" → "Owner user id". */
export function fieldLabel(field: string): string {
  const spaced = field.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

/** A stored value as short text; objects and lists as compact JSON. */
export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value.length > 0 ? value : '(empty)';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value, null, 1).replace(/\n\s*/g, ' ');
}

export interface FieldChange {
  readonly field: string;
  readonly before: unknown;
  readonly after: unknown;
  readonly changed: boolean;
}

/** Every field in either snapshot, changed ones first. */
export function fieldChanges(
  before: Readonly<Record<string, unknown>> | null,
  after: Readonly<Record<string, unknown>> | null,
): FieldChange[] {
  const fields = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])];
  return fields
    .map((field) => {
      const was = before?.[field];
      const now = after?.[field];
      return {
        field,
        before: was,
        after: now,
        changed: JSON.stringify(was) !== JSON.stringify(now),
      };
    })
    .sort((left, right) => Number(right.changed) - Number(left.changed));
}
