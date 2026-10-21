import { DARK_COLORS, LIGHT_COLORS } from '@lintel/design-system/tokens';
import { planEmailDigest } from '@lintel/domain';
import { toCalendarDate } from '@lintel/shared';
import { describe, expect, it } from 'vitest';
import { composeDigestEmail, formatDigestDate } from './digest-email';
import { EMAIL_COLORS, escapeHtml } from './email-layout';
import { composeNotificationEmail } from './notification-email';

const base = {
  notificationId: 'n1',
  deliveryId: 'd1',
  kind: 'review_requested' as const,
  title: 'Review <Kitchen> "v2" & more',
  body: 'Tara sent it for your review.',
  linkPath: '/deliverables/abc',
  to: 'nisha@studio.example',
  recipientName: 'Nisha Varma',
  studioName: 'Aranya Design Studio',
  webBaseUrl: 'https://studio.example.com',
};

describe('notification email', () => {
  it('has a readable plain-text part and an accessible HTML part', () => {
    const email = composeNotificationEmail(base);
    expect(email.text).toContain('Hello Nisha,');
    expect(email.text).toContain('Open in Lintel: https://studio.example.com/deliverables/abc');
    expect(email.text).toContain('https://studio.example.com/account#notifications');
    expect(email.html).toContain('<html lang="en-IN">');
    expect(email.html).toContain('role="presentation"');
    expect(email.html).toContain('<meta name="color-scheme" content="light dark">');
    expect(email.html).toMatch(/<h1[^>]*>Review &lt;Kitchen&gt; &quot;v2&quot; &amp; more<\/h1>/);
    expect(email.html).not.toContain('<Kitchen>');
  });

  it('never links outside the app, whatever the stored path', () => {
    const email = composeNotificationEmail({ ...base, linkPath: '//evil.example/steal' });
    expect(email.html).not.toContain('evil.example');
    expect(email.text).toContain('https://studio.example.com/today');
  });
});

describe('digest email', () => {
  it('lists each section with linked items and counts the rest', () => {
    const items = ['a', 'b', 'c'].map((id, index) => ({
      notificationId: id,
      kind: index === 0 ? ('task_blocked' as const) : ('task_assigned' as const),
      title: `Item ${id}`,
      body: `Body ${id}`,
      linkPath: `/tasks/${id}`,
      createdAt: new Date(`2026-11-09T0${index}:00:00Z`),
    }));
    const plan = planEmailDigest(items, 2);
    if (!plan) throw new Error('expected a plan');
    const email = composeDigestEmail({
      digestId: 'g1',
      digestDate: toCalendarDate('2026-11-09'),
      plan,
      to: 'nisha@studio.example',
      recipientName: 'Nisha Varma',
      studioName: 'Aranya Design Studio',
      webBaseUrl: 'https://studio.example.com',
    });
    expect(email.subject).toBe('Your Lintel digest for Monday 9 November: 3 updates');
    expect(email.text).toContain('And 1 more update in your Lintel notifications.');
    expect(email.html).toContain('<h2');
    expect(email.html).toContain('href="https://studio.example.com/tasks/a"');
    expect(email.messageId).toBe('<digest.g1@studio.example.com>');
  });

  it('formats the business day', () => {
    expect(formatDigestDate(toCalendarDate('2026-11-10'))).toBe('Tuesday 10 November');
  });
});

describe('email brand colours', () => {
  it('match the Linen & Cyanotype design tokens', () => {
    for (const [name, value] of Object.entries(EMAIL_COLORS.light)) {
      expect(LIGHT_COLORS[name as keyof typeof LIGHT_COLORS]).toBe(value);
    }
    for (const [name, value] of Object.entries(EMAIL_COLORS.dark)) {
      expect(DARK_COLORS[name as keyof typeof DARK_COLORS]).toBe(value);
    }
  });

  it('escapes every HTML-special character', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;',
    );
  });
});
