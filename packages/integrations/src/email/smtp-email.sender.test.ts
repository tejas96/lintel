import type { SendMailOptions } from 'nodemailer';
import { describe, expect, it } from 'vitest';
import { DevelopmentEmailSender } from './development-email.sender';
import { classifySmtpError, type MailTransport, SmtpEmailSender } from './smtp-email.sender';

const config = {
  host: 'smtp.example.com',
  port: 587,
  secure: false,
  requireTls: true,
  user: 'lintel',
  password: 'secret',
  from: 'Lintel <notifications@studio.example.com>',
  timeoutMs: 5000,
};

const message = {
  to: 'ananya@studio.example',
  subject: 'Work waits for your review',
  text: 'Plain text',
  html: '<p>HTML</p>',
  messageId: '<notification.n1@lintel>',
  reference: 'delivery-1',
};

function fakeTransport(result: () => Promise<Awaited<ReturnType<MailTransport['sendMail']>>>) {
  const sent: SendMailOptions[] = [];
  let closed = false;
  const transport: MailTransport = {
    async sendMail(mail) {
      sent.push(mail);
      return result();
    },
    close() {
      closed = true;
    },
  };
  return { transport, sent, closed: () => closed };
}

function smtpError(code: string, responseCode?: number) {
  return Object.assign(new Error(`server said something about ${message.to}`), {
    code,
    ...(responseCode ? { responseCode } : {}),
  });
}

describe('SMTP email sender', () => {
  it('sends text and HTML with the deterministic Message-ID and no auto-replies', async () => {
    const fake = fakeTransport(async () => ({
      messageId: '<notification.n1@lintel>',
      accepted: [message.to],
      rejected: [],
    }));
    const sender = new SmtpEmailSender(config, fake.transport);
    expect(await sender.send(message)).toEqual({
      outcome: 'sent',
      providerMessageId: '<notification.n1@lintel>',
    });
    expect(fake.sent[0]).toMatchObject({
      from: config.from,
      to: message.to,
      subject: message.subject,
      text: 'Plain text',
      html: '<p>HTML</p>',
      messageId: '<notification.n1@lintel>',
      headers: { 'Auto-Submitted': 'auto-generated', 'X-Lintel-Reference': 'delivery-1' },
    });
    await sender.close();
    expect(fake.closed()).toBe(true);
  });

  it('reports a refused recipient as a permanent failure', async () => {
    const fake = fakeTransport(async () => ({
      messageId: 'x',
      accepted: [],
      rejected: [message.to],
    }));
    const result = await new SmtpEmailSender(config, fake.transport).send(message);
    expect(result).toEqual({
      outcome: 'permanent_failure',
      reason: 'The mail server refused the recipient.',
    });
  });

  it('maps failures without keeping server text or the address', async () => {
    const fake = fakeTransport(async () => {
      throw smtpError('ECONNECTION');
    });
    const result = await new SmtpEmailSender(config, fake.transport).send(message);
    expect(result).toEqual({
      outcome: 'retryable_failure',
      reason: 'The mail server could not be reached.',
    });
    expect(JSON.stringify(result)).not.toContain(message.to);
  });

  it('retries 4xx replies and gives up on credentials, TLS and 5xx replies', () => {
    expect(classifySmtpError(smtpError('EENVELOPE', 451)).outcome).toBe('retryable_failure');
    expect(classifySmtpError(smtpError('ETIMEDOUT')).outcome).toBe('retryable_failure');
    expect(classifySmtpError(smtpError('EAUTH', 535))).toEqual({
      outcome: 'permanent_failure',
      reason: 'The mail server rejected the SMTP credentials.',
    });
    expect(classifySmtpError(smtpError('ETLS')).outcome).toBe('permanent_failure');
    expect(classifySmtpError(smtpError('EMESSAGE', 554)).outcome).toBe('permanent_failure');
    expect(classifySmtpError('not an error').outcome).toBe('permanent_failure');
  });

  it('builds a real Nodemailer transport from the configuration without connecting', () => {
    expect(() => new SmtpEmailSender(config)).not.toThrow();
  });
});

describe('development email sender', () => {
  it('writes the message to the log with a masked address and never claims delivery', async () => {
    const lines: string[] = [];
    const sender = new DevelopmentEmailSender({ info: (line) => lines.push(line) }, 'test');
    const result = await sender.send(message);
    expect(result.outcome).toBe('not_configured');
    expect(lines[0]).toContain('a•••@studio.example');
    expect(lines[0]).toContain('Subject: Work waits for your review');
    expect(lines[0]).not.toContain(message.to);
  });

  it('refuses to exist in production', () => {
    expect(() => new DevelopmentEmailSender({ info: () => undefined }, 'production')).toThrow(
      /production/,
    );
  });
});
