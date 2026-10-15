/**
 * Sending the Contact form through Web3Forms (desktop spec §9.5, plan stage 11.3): the person's own public
 * access key, the visitor's name, email and message, posted to Web3Forms, which emails the person. No server
 * of ours. A message a bot filled the hidden field of is dropped here, said to be sent.
 */

export const WEB3FORMS = 'https://api.web3forms.com/submit';

export type Sent = 'sent' | 'network' | 'rate' | 'server';

/** What Web3Forms is sent: the subject says an access request apart from a message. Pure. */
export function web3formsBody(key: string, f: { name: string; email: string; message: string }, about: string | null) {
  return {
    access_key: key,
    subject: about === null ? `A message from ${f.name}` : `${f.name} asks for access${about ? ` to ${about}` : ''}`,
    from_name: f.name,
    name: f.name,
    email: f.email,
    message: f.message,
  };
}

/** Sends a message; says how it went. */
export async function sendWeb3Forms(key: string, f: { name: string; email: string; message: string }, o: { about: string | null; trap: string; timeout: number }): Promise<Sent> {
  if (o.trap) return 'sent';
  let r: Response;
  try {
    r = await fetch(WEB3FORMS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(web3formsBody(key, f, o.about)),
      signal: AbortSignal.timeout(o.timeout),
    });
  } catch {
    return 'network';
  }
  const data = (await r.json().catch(() => ({}))) as { success?: boolean };
  if (r.ok && data.success !== false) return 'sent';
  return r.status === 429 ? 'rate' : 'server';
}
