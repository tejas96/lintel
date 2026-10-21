import type { EmailMessage } from '@lintel/application';
import { messagePreviewFor, type NotificationKind } from '@lintel/domain';
import { appLink } from '@lintel/shared';
import { escapeHtml, renderButton, renderEmailFrame, STYLES } from './email-layout';

export interface NotificationEmailInput {
  readonly notificationId: string;
  readonly deliveryId: string;
  readonly kind: NotificationKind;
  readonly title: string;
  readonly body: string;
  readonly linkPath: string | null;
  readonly to: string;
  readonly recipientName: string;
  readonly studioName: string;
  readonly webBaseUrl: string;
}

/** `<kind.id@host>`: the same message keeps the same Message-ID on every retry. */
export function emailMessageId(kind: 'notification' | 'digest', id: string, webBaseUrl: string) {
  return `<${kind}.${id}@${new URL(webBaseUrl).hostname}>`;
}

export function preferencesLink(webBaseUrl: string): string {
  return `${appLink(webBaseUrl, '/account')}#notifications`;
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

export function footerText(studioName: string, webBaseUrl: string, why: string): string {
  return [
    `${why}`,
    `Change what reaches you: ${preferencesLink(webBaseUrl)}`,
    `${studioName} · Lintel`,
  ].join('\n');
}

export function footerHtml(studioName: string, webBaseUrl: string, why: string): string {
  const link = escapeHtml(preferencesLink(webBaseUrl));
  return [
    `<p style="margin:0 0 6px;">${escapeHtml(why)}</p>`,
    `<p style="margin:0 0 6px;"><a class="lt-faint" href="${link}" style="${STYLES.footerLink}">Change what reaches you</a></p>`,
    `<p style="margin:0;">${escapeHtml(studioName)} · Lintel</p>`,
  ].join('\n');
}

/**
 * One notification as an email: the inbox title and text (or a generic line
 * for sensitive kinds), a single "Open in Lintel" action and a footer that
 * says why it arrived. Opening the link re-checks permissions.
 */
export function composeNotificationEmail(input: NotificationEmailInput): EmailMessage {
  const preview = messagePreviewFor(input.kind, input.title, input.body);
  const link = appLink(input.webBaseUrl, input.linkPath);
  const why = 'You get this email because you chose email for this kind of notification.';
  const greeting = `Hello ${firstName(input.recipientName)},`;
  const text = [
    greeting,
    '',
    preview.title,
    '',
    preview.body,
    '',
    `Open in Lintel: ${link}`,
    '',
    '—',
    footerText(input.studioName, input.webBaseUrl, why),
  ].join('\n');
  const contentHtml = [
    `<p class="lt-muted" style="${STYLES.body}margin-bottom:16px;">${escapeHtml(greeting)}</p>`,
    `<h1 class="lt-ink" style="${STYLES.heading}">${escapeHtml(preview.title)}</h1>`,
    `<p class="lt-muted" style="${STYLES.body}">${escapeHtml(preview.body)}</p>`,
    renderButton('Open in Lintel', link),
  ].join('\n');
  return {
    to: input.to,
    subject: preview.title,
    text,
    html: renderEmailFrame({
      title: preview.title,
      preheader: preview.body,
      contentHtml,
      footerHtml: footerHtml(input.studioName, input.webBaseUrl, why),
    }),
    messageId: emailMessageId('notification', input.notificationId, input.webBaseUrl),
    reference: input.deliveryId,
  };
}
