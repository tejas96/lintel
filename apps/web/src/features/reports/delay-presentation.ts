import type { DelayKindView, DelaysReport } from '@lintel/api-contracts';

/** How each kind of approval wait is named on screen. */
export const DELAY_WORDS: Readonly<
  Record<DelayKindView, { title: string; short: string; one: string; many: string }>
> = {
  client_signoff: {
    title: 'Client sign-offs',
    short: 'Sign-offs',
    one: 'sign-off',
    many: 'sign-offs',
  },
  client_wait: {
    title: 'Waiting on the client',
    short: 'Client waits',
    one: 'wait',
    many: 'waits',
  },
  internal_review: {
    title: 'Internal reviews',
    short: 'Reviews',
    one: 'review',
    many: 'reviews',
  },
};

type SlowItem = DelaysReport['slowest'][number];

/** Sign-offs open the project timeline, client waits the task, reviews the deliverable. */
export function delayLink(row: SlowItem): string {
  if (row.kind === 'client_signoff') return `/projects/${row.project.id}/timeline`;
  if (row.kind === 'client_wait') return `/tasks/${row.recordId}`;
  return `/deliverables/${row.recordId}`;
}

/** "Sign-offs 2 of 3 delayed · Reviews 1 waiting" for one client or project. */
export function kindSummary(kinds: DelaysReport['byClient'][number]['kinds']): string {
  return kinds
    .map((row) => {
      const parts = [
        row.count > 0 ? `${row.delayed} of ${row.count} delayed` : null,
        row.waitingNow > 0 ? `${row.waitingNow} waiting` : null,
      ].filter(Boolean);
      return `${DELAY_WORDS[row.kind].short} ${parts.join(', ')}`;
    })
    .join(' · ');
}
