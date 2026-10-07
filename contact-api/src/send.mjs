// @ts-check
/**
 * The email a message becomes (documentation/contact/spec.md §4.3): plain text only, to the address in
 * CONTACT_TO, with the visitor as Reply-To. It's sent by Prabin's own Gmail account over Gmail's SMTP when
 * GMAIL_USER and GMAIL_APP_PASSWORD are set (Gmail signs it as his and files it as his own mail, so it isn't
 * taken for spam), else from the Azure-managed sender.
 */
import { EmailClient } from '@azure/communication-email';

/** The sender's display name, either way. */
export const DISPLAY_NAME = "Prabin's site";

/** @type {EmailClient | undefined} */
let client;
/** @type {{ sendMail(message: object): Promise<unknown> } | undefined} */
let smtp;

/**
 * Which way a message goes, from the app's settings: Gmail when both its settings are there (an app
 * password is shown in groups of four; the spaces aren't part of it), else Azure Communication Services.
 * @param {Record<string, string | undefined>} env
 * @returns {{ via: 'gmail'; user: string; pass: string } | { via: 'acs' }}
 */
export function transport(env) {
  const user = (env.GMAIL_USER ?? '').trim();
  const pass = (env.GMAIL_APP_PASSWORD ?? '').replace(/\s+/g, '');
  return user && pass ? { via: 'gmail', user, pass } : { via: 'acs' };
}

/**
 * The email's subject and body.
 * @param {{ name: string; email: string; message: string; about?: string }} m
 * @param {Date} [at]
 */
export function compose(m, at = new Date()) {
  const access = m.about !== undefined;
  const subject = `${access ? 'Access request' : 'Message'} from ${m.name}`;
  const lines = [
    `From: ${m.name} <${m.email}>`,
    ...(access ? [`About: an access code for ${m.about || 'the shared work'}`] : []),
    `Sent: ${at.toISOString().replace('T', ' ').slice(0, 16)} UTC, from the contact form on your site`,
    '',
    m.message,
    '',
    '--',
    'Reply to this email to answer them.',
  ];
  return { subject, plainText: lines.join('\n') };
}

/**
 * The message as Gmail sends it: from his own account, under the site's display name, to CONTACT_TO, with
 * the visitor to reply to. Plain text only.
 * @param {{ name: string; email: string; message: string; about?: string }} m
 * @param {string} user
 * @param {string} to
 * @param {Date} [at]
 */
export function gmailMessage(m, user, to, at = new Date()) {
  const { subject, plainText } = compose(m, at);
  return { from: { name: DISPLAY_NAME, address: user }, to, replyTo: { name: m.name, address: m.email }, subject, text: plainText };
}

/**
 * Hands it to the email service; throws if the service doesn't take it. It answers once the email is
 * accepted (queued for delivery), not delivered: delivery takes seconds more, and the visitor needn't wait.
 * @param {{ name: string; email: string; message: string; about?: string }} m
 */
export async function send(m) {
  const t = transport(process.env);
  if (t.via === 'gmail') {
    if (!smtp) {
      const { default: nodemailer } = await import('nodemailer');
      smtp = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: t.user, pass: t.pass } });
    }
    await smtp.sendMail(gmailMessage(m, t.user, process.env.CONTACT_TO ?? ''));
    return;
  }
  client ??= new EmailClient(process.env.ACS_CONNECTION_STRING ?? '');
  const poller = await client.beginSend({
    senderAddress: process.env.CONTACT_FROM ?? '',
    content: compose(m),
    recipients: { to: [{ address: process.env.CONTACT_TO ?? '' }] },
    replyTo: [{ address: m.email, displayName: m.name }],
  });
  const state = poller.getOperationState();
  if (state.error) throw new Error('the email service refused it');
}
