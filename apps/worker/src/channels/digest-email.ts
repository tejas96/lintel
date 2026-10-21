import type { EmailMessage } from '@lintel/application';
import type { DigestEntry, EmailDigestPlan } from '@lintel/domain';
import { appLink, type CalendarDate } from '@lintel/shared';
import { escapeHtml, renderButton, renderEmailFrame, STYLES } from './email-layout';
import { emailMessageId, firstName, footerHtml, footerText } from './notification-email';

export interface DigestEmailInput {
  readonly digestId: string;
  readonly digestDate: CalendarDate;
  readonly plan: EmailDigestPlan;
  readonly to: string;
  readonly recipientName: string;
  readonly studioName: string;
  readonly webBaseUrl: string;
}

/** "Monday 9 November" for the business day the digest covers. */
export function formatDigestDate(date: CalendarDate): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
    .format(new Date(`${date}T00:00:00Z`))
    .replace(',', '');
}

function updates(count: number): string {
  return `${count} ${count === 1 ? 'update' : 'updates'}`;
}

function entryText(entry: DigestEntry, webBaseUrl: string): string {
  return `• ${entry.title}\n  ${entry.body}\n  ${appLink(webBaseUrl, entry.linkPath)}`;
}

function entryHtml(entry: DigestEntry, webBaseUrl: string): string {
  const href = escapeHtml(appLink(webBaseUrl, entry.linkPath));
  return `<li style="margin:0 0 14px;padding:0;"><a class="lt-link" href="${href}" style="${STYLES.itemTitle}">${escapeHtml(entry.title)}</a><p class="lt-muted" style="${STYLES.itemBody}">${escapeHtml(entry.body)}</p></li>`;
}

/**
 * The daily digest: one email per person and day, sections in the usual
 * order (most pressing first), each item linking to its record. Sensitive
 * items were already reduced to a generic line by the domain plan.
 */
export function composeDigestEmail(input: DigestEmailInput): EmailMessage {
  const { plan, webBaseUrl } = input;
  const day = formatDigestDate(input.digestDate);
  const subject = `Your Lintel digest for ${day}: ${updates(plan.total)}`;
  const today = appLink(webBaseUrl, '/today');
  const more =
    plan.hidden > 0
      ? `And ${plan.hidden} more ${plan.hidden === 1 ? 'update' : 'updates'} in your Lintel notifications.`
      : null;
  const why = 'You get this digest because you chose a daily email digest.';
  const intro = `Here is what happened in ${input.studioName} on ${day}.`;
  const text = [
    `Hello ${firstName(input.recipientName)},`,
    '',
    intro,
    ...plan.sections.flatMap((section) => [
      '',
      section.title.toUpperCase(),
      ...section.entries.map((entry) => entryText(entry, webBaseUrl)),
    ]),
    ...(more ? ['', more] : []),
    '',
    `Open Lintel: ${today}`,
    '',
    '—',
    footerText(input.studioName, webBaseUrl, why),
  ].join('\n');
  const sectionsHtml = plan.sections
    .map(
      (section) =>
        `<h2 class="lt-muted lt-rule" style="${STYLES.subheading}">${escapeHtml(section.title)}</h2>\n<ul style="margin:0;padding:0;list-style:none;">${section.entries.map((entry) => entryHtml(entry, webBaseUrl)).join('')}</ul>`,
    )
    .join('\n');
  const contentHtml = [
    `<h1 class="lt-ink" style="${STYLES.heading}">Your day in Lintel</h1>`,
    `<p class="lt-muted" style="${STYLES.body}">${escapeHtml(intro)}</p>`,
    sectionsHtml,
    more ? `<p class="lt-muted" style="${STYLES.body}margin-top:8px;">${escapeHtml(more)}</p>` : '',
    renderButton('Open Lintel', today),
  ].join('\n');
  return {
    to: input.to,
    subject,
    text,
    html: renderEmailFrame({
      title: subject,
      preheader: `${updates(plan.total)} from ${input.studioName}.`,
      contentHtml,
      footerHtml: footerHtml(input.studioName, webBaseUrl, why),
    }),
    messageId: emailMessageId('digest', input.digestId, webBaseUrl),
    reference: input.digestId,
  };
}
