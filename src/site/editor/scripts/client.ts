/**
 * Edit mode's browser client: calls to the editor API (with the header the guard asks for), and the
 * top bar's save status. Every editor screen's script uses it.
 */
export interface Issue {
  file: string;
  path?: string;
  message: string;
}

export interface Reply<T = Record<string, unknown>> {
  status: number;
  ok: boolean;
  data: T & { ok?: boolean; issues?: Issue[]; versions?: Record<string, string | null> };
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
export const editorUrl = (path = '') => `${BASE}/_edit/${path}`;

/** Calls the editor API. A body that's FormData goes as multipart; anything else as JSON. */
export async function api<T = Record<string, unknown>>(method: string, path: string, body?: unknown): Promise<Reply<T>> {
  const headers: Record<string, string> = { 'X-Editor': '1' };
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}/_edit/api/${path}`, { method, headers, body: payload, credentials: 'same-origin' });
  let data: Reply<T>['data'];
  try {
    data = await res.json();
  } catch {
    data = { ok: false, issues: [{ file: '', message: `the editor couldn't read the answer (${res.status})` }] } as Reply<T>['data'];
  }
  return { status: res.status, ok: res.ok && data.ok !== false, data };
}

/** Says something in the top bar's status (a live region), optionally as a problem. */
export function announce(text: string, tone: 'default' | 'negative' = 'default') {
  const el = document.querySelector<HTMLElement>('[data-editor-status]');
  if (!el) return;
  el.textContent = text;
  if (tone === 'negative') el.dataset.tone = 'negative';
  else delete el.dataset.tone;
}

/** An issue in words, for the status and field messages. */
export const describeIssue = (i: Issue) => `${i.path ? `${i.path}: ` : ''}${i.message}`;
