/**
 * The request guard for edit mode (documentation/editor/spec.md §8.2). Pure, so every rule is
 * unit-tested; the middleware applies it to every editor route.
 *
 * - Every request: the client is on the loopback address, and `Host` names localhost, 127.0.0.1 or
 *   [::1] (against DNS rebinding, and against `astro dev --host` exposing the editor to a network).
 * - A request that writes (anything but GET and HEAD) also carries `X-Editor: 1` (a cross-origin page
 *   can't send it without a CORS preflight), comes from exactly this origin (a write without an Origin
 *   is refused), isn't marked cross-site by `Sec-Fetch-Site`, and has a JSON or multipart body.
 */
export interface GuardRequest {
  method: string;
  url: URL;
  clientAddress: string | undefined;
  header(name: string): string | null;
}

export type Verdict = { ok: true } | { ok: false; reason: string };

const LOOPBACK = /^(127(?:\.\d{1,3}){3}|::1|::ffff:127(?:\.\d{1,3}){3})$/i;
const LOCAL_HOST = /^(localhost|127(?:\.\d{1,3}){3}|\[::1\])(:\d{1,5})?$/i;
const BODY = /^(application\/json|multipart\/form-data)(;|$)/i;

/** Headers every editor response carries: no page elsewhere may frame the editor (clickjacking). */
export const FRAME_HEADERS: Record<string, string> = {
  'Content-Security-Policy': "frame-ancestors 'self'",
  'X-Frame-Options': 'SAMEORIGIN',
  'Cache-Control': 'no-store',
};

export function guard(req: GuardRequest): Verdict {
  if (!req.clientAddress || !LOOPBACK.test(req.clientAddress)) return { ok: false, reason: 'not a loopback client' };
  const host = req.header('host') ?? '';
  if (!LOCAL_HOST.test(host)) return { ok: false, reason: 'not a local host name' };
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD') return { ok: true };
  if (req.header('x-editor') !== '1') return { ok: false, reason: 'missing the editor header' };
  const origin = req.header('origin');
  if (!origin || origin !== `${req.url.protocol}//${host}`) return { ok: false, reason: 'not from this origin' };
  const site = req.header('sec-fetch-site');
  if (site && site !== 'same-origin') return { ok: false, reason: 'marked cross-site' };
  if (method !== 'DELETE' && !BODY.test(req.header('content-type') ?? '')) return { ok: false, reason: 'not a JSON or multipart body' };
  return { ok: true };
}
