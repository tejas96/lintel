import { describe, expect, it } from 'vitest';
import { type DigestItem, planEmailDigest } from './email-digest.policy';
import type { NotificationKind } from './notification-kinds';

let counter = 0;
function item(kind: NotificationKind, at: string, title = `${kind} title`): DigestItem {
  counter += 1;
  return {
    notificationId: `n-${counter}`,
    kind,
    title,
    body: `${kind} body`,
    linkPath: `/tasks/${counter}`,
    createdAt: new Date(at),
  };
}

describe('email digest grouping', () => {
  it('skips the digest when nothing is waiting', () => {
    expect(planEmailDigest([])).toBeNull();
  });

  it('groups items into sections in the usual order, most pressing first', () => {
    const plan = planEmailDigest([
      item('review_requested', '2026-11-09T05:00:00Z'),
      item('task_assigned', '2026-11-09T07:00:00Z'),
      item('task_overdue', '2026-11-09T09:00:00Z'),
      item('task_assigned', '2026-11-09T04:00:00Z'),
      item('project_at_risk', '2026-11-09T03:00:00Z'),
    ]);
    expect(plan?.total).toBe(5);
    expect(plan?.hidden).toBe(0);
    expect(plan?.sections.map((section) => section.title)).toEqual([
      'Your work',
      'Blockers and reviews',
      'Projects and recognition',
    ]);
    // High urgency (overdue) first, then the normal ones oldest first.
    const work = plan?.sections[0]?.entries ?? [];
    expect(work.map((entry) => `${entry.kind}@${entry.createdAt.getUTCHours()}`)).toEqual([
      'task_overdue@9',
      'task_assigned@4',
      'task_assigned@7',
    ]);
  });

  it('never puts sensitive details in an email', () => {
    const plan = planEmailDigest([
      item('reward_updated', '2026-11-09T05:00:00Z', 'Reward approved: ₹5,000'),
    ]);
    const entry = plan?.sections[0]?.entries[0];
    expect(entry?.title).toBe('You have a private update');
    expect(entry?.body).not.toContain('₹');
    expect(entry?.linkPath).toBe(`/tasks/${counter}`);
  });

  it('caps a long digest and counts the rest', () => {
    const items = Array.from({ length: 7 }, (_, index) =>
      item('blocker_resolved', `2026-11-09T0${index}:00:00Z`),
    );
    const plan = planEmailDigest([...items, item('task_blocked', '2026-11-09T08:00:00Z')], 3);
    expect(plan?.total).toBe(8);
    expect(plan?.hidden).toBe(5);
    const shown = plan?.sections.flatMap((section) => section.entries.map((entry) => entry.kind));
    expect(shown).toEqual(['task_blocked', 'blocker_resolved', 'blocker_resolved']);
  });
});
