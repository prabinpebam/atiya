// @ts-check
/**
 * The email a message becomes (documentation/contact/spec.md §4.3): plain text only, to the address in
 * CONTACT_TO, from the Azure-managed sender, with the visitor as Reply-To.
 */
import { EmailClient } from '@azure/communication-email';

/** @type {EmailClient | undefined} */
let client;

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
 * Hands it to the email service; throws if the service doesn't take it. It answers once the email is
 * accepted (queued for delivery), not delivered: delivery takes seconds more, and the visitor needn't wait.
 * @param {{ name: string; email: string; message: string; about?: string }} m
 */
export async function send(m) {
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
