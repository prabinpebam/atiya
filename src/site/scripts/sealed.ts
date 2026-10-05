/**
 * The sign-in runtime (documentation/access/spec.md §4.3, §5, §7): it reads a magic link, signs in with an
 * access code, opens the keyring of this build, decrypts the cards and pages the grant covers into the
 * page, decrypts their pictures and videos as they come into view, and signs out of every tab. It's
 * loaded only where it's needed (scripts/access.ts): a protected page, a section with sealed cards, the
 * Sign in page, or any page while signed in. Telemetry hears what happens through `site:access` events.
 */
import { each } from './page';
import { b64, deriveCodeKey, deriveLinkKey, open, utf8 } from '../access/crypto.ts';
import { KeyringError, cardAad, checkEnvelope, mediaAad, openKeyring, pageAad } from '../access/keyring.ts';
import { parseCode } from '../access/parse.ts';
import { afterSignOut, messageFor, onMissingKeyring, parseFragment, pickFromSrcset, readSession, safeReturn, sessionExpired, untilWords, withoutSecret, type Outcome, type Session } from '../access/session.ts';
import type { KeyringBody } from '../access/types.ts';

const STORE = 'site.access';
const RELOADED = 'site.access.reloaded';
const MEDIA_MAX = 12 * 1024 * 1024;
const PAYLOAD_MAX = 4 * 1024 * 1024;
const base = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
const html = document.documentElement;

type Payload = { v: 1; html: string; after?: string | null; media: Record<string, { key: string; type: string }> };

/** The build this page belongs to: its keyrings and sealed files live under it. */
const build = () => document.querySelector<HTMLMetaElement>('meta[name="site-build"]')?.content ?? '';

/** Tells telemetry (scripts/telemetry.ts) what happened: never a code, a secret or a title. */
const tell = (event: string, props: Record<string, string | number> = {}) => document.dispatchEvent(new CustomEvent('site:access', { detail: { event, ...props } }));

function storage(kind: 'session' | 'local'): Storage | null {
  try {
    return kind === 'session' ? sessionStorage : localStorage;
  } catch {
    return null;
  }
}
const stored = (): Session | null => readSession(storage('session')?.getItem(STORE) ?? null) ?? readSession(storage('local')?.getItem(STORE) ?? null);
function keep(s: Session, remember: boolean) {
  storage('session')?.setItem(STORE, JSON.stringify(s));
  if (remember) storage('local')?.setItem(STORE, JSON.stringify(s));
  html.dataset.signedIn = '';
}
function forget() {
  storage('session')?.removeItem(STORE);
  storage('local')?.removeItem(STORE);
  delete html.dataset.signedIn;
}

/** Announces a message in the place it belongs (a panel's status, the sign-in line) and to screen readers. */
function say(outcome: Outcome, where: Element | null, o: { expiresAt?: string; cards?: number } = {}) {
  const text = messageFor(outcome, o);
  const status = where?.querySelector<HTMLElement>('[data-unlock-status], [data-sign-in-status]');
  if (status) status.textContent = text;
  else {
    let live = document.querySelector<HTMLElement>('[data-access-live]');
    if (!live) {
      live = document.createElement('p');
      live.dataset.accessLive = '';
      live.setAttribute('role', 'status');
      live.className = 'sr-only';
      document.body.append(live);
    }
    live.textContent = text;
  }
  return text;
}

/** The keyring of this build for a session: opened, or why not. */
async function keyring(s: Session): Promise<{ ok: true; body: KeyringBody } | { ok: false; outcome: Outcome; expiresAt?: string }> {
  if (sessionExpired(s)) return { ok: false, outcome: 'expired', expiresAt: s.expiresAt };
  let res: Response;
  try {
    res = await fetch(`${base}/_access/${build()}/${s.lookup}.json`, { cache: 'no-store' });
  } catch {
    return { ok: false, outcome: 'offline' };
  }
  if (res.status === 404) {
    // a page from an earlier deploy asks for a keyring that's gone: reload once, past the cache
    if (onMissingKeyring(storage('session')?.getItem(RELOADED) ?? null, build()) === 'reload') {
      storage('session')?.setItem(RELOADED, build());
      location.reload();
      return new Promise(() => {});
    }
    return { ok: false, outcome: 'withdrawn' };
  }
  if (!res.ok) return { ok: false, outcome: 'offline' };
  try {
    const text = await res.text();
    const env = checkEnvelope(JSON.parse(text), text.length);
    if (env.build !== build()) return { ok: false, outcome: 'stale' };
    return { ok: true, body: await openKeyring(b64.decode(s.kek), s.lookup, env) };
  } catch (e) {
    if (e instanceof KeyringError && e.code === 'expired') return { ok: false, outcome: 'expired', expiresAt: (e as KeyringError & { expiresAt?: string }).expiresAt };
    return { ok: false, outcome: 'withdrawn' };
  }
}

// ---------- pictures and videos, decrypted as they come into view ----------

const blobs = new Set<string>();
const mediaKeys = new Map<string, { key: string; type: string }>();
const nameOfUrl = (url: string) => /\/_sealed\/[\w-]+\/([\w-]+)\.bin$/.exec(url)?.[1];

async function decryptMedia(url: string): Promise<string | null> {
  const name = nameOfUrl(url);
  const m = name && mediaKeys.get(name);
  if (!name || !m) return null;
  const res = await fetch(url);
  if (!res.ok) return null;
  const plain = await open(b64.decode(m.key), new Uint8Array(await res.arrayBuffer()), mediaAad(build(), name), MEDIA_MAX);
  const blobUrl = URL.createObjectURL(new Blob([plain as BlobPart], { type: m.type }));
  blobs.add(blobUrl);
  return blobUrl;
}

const seen = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      seen.unobserve(e.target);
      void reveal(e.target as HTMLElement);
    }
  },
  { rootMargin: '400px 0px' },
);

/** Fills in one sealed element: a picture (and its dark version), a video's poster and file. */
async function reveal(el: HTMLElement) {
  if (el instanceof HTMLImageElement) {
    const width = Math.max(el.getBoundingClientRect().width, 160) * (window.devicePixelRatio || 1);
    const pick = pickFromSrcset(el.dataset.sealedSrcset ?? '', width) ?? el.dataset.sealedSrc;
    for (const source of el.parentElement?.querySelectorAll<HTMLSourceElement>('source[data-sealed-srcset]') ?? []) {
      const dark = pickFromSrcset(source.dataset.sealedSrcset!, width);
      if (dark) {
        const u = await decryptMedia(dark);
        if (u) source.srcset = u;
      }
    }
    const u = pick && (await decryptMedia(pick));
    if (u) {
      el.removeAttribute('sizes');
      el.src = u;
    }
    return;
  }
  if (el instanceof HTMLVideoElement) {
    if (el.dataset.sealedPoster) {
      const u = await decryptMedia(el.dataset.sealedPoster);
      if (u) el.poster = u;
    }
    let changed = false;
    for (const source of el.querySelectorAll<HTMLSourceElement>('source[data-sealed-src]')) {
      const u = await decryptMedia(source.dataset.sealedSrc!);
      if (u) {
        source.src = u;
        changed = true;
      }
    }
    if (changed) el.load();
  }
}

function watchMedia(root: ParentNode, media: Payload['media']) {
  for (const [name, m] of Object.entries(media)) mediaKeys.set(name, m);
  root.querySelectorAll<HTMLElement>('img[data-sealed-src], img[data-sealed-srcset], video[data-sealed-poster], video:has(source[data-sealed-src])').forEach((el) => seen.observe(el));
}

/** A link to a sealed file (the lightbox's full size, a video's download): decrypted on the first click, with its group. */
document.addEventListener(
  'click',
  (e) => {
    const link = (e.target as Element | null)?.closest<HTMLAnchorElement>('a[href*="/_sealed/"]');
    if (!link) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const group = link.dataset.lightbox ? [...document.querySelectorAll<HTMLAnchorElement>(`a[data-lightbox="${CSS.escape(link.dataset.lightbox)}"]`)] : [link];
    void Promise.all(
      group.flatMap((a) =>
        (['href', 'data-full-dark', 'data-thumb', 'data-thumb-dark'] as const).map(async (attr) => {
          const v = a.getAttribute(attr);
          if (!v || !v.includes('/_sealed/')) return;
          const u = await decryptMedia(v);
          if (u) a.setAttribute(attr, u);
        }),
      ),
    ).then(() => link.click());
  },
  true,
);

// ---------- cards and pages ----------

/**
 * A component's script sits where the component does, so the sealed page's own scripts (the lightbox's,
 * the minimap's) come in with it; inserted as HTML they'd never run, so each is made again.
 */
function activateScripts(root: ParentNode) {
  for (const old of root.querySelectorAll('script')) {
    const s = document.createElement('script');
    for (const a of old.attributes) s.setAttribute(a.name, a.value);
    s.textContent = old.textContent;
    old.replaceWith(s);
  }
}

async function decrypt(tpl: HTMLTemplateElement, keys: KeyringBody['keys'], kind: 'main' | 'card'): Promise<Payload | null> {
  const kid = tpl.dataset.kid!;
  const key = keys[kid];
  if (!key) return null;
  const sealed = b64.decode((tpl.content.textContent || tpl.textContent || '').trim());
  const plain = await open(b64.decode(key), sealed, kind === 'main' ? pageAad(build(), kid) : cardAad(build(), kid), PAYLOAD_MAX);
  return JSON.parse(utf8.decode(plain)) as Payload;
}

/** A section's sealed cards the grant covers, each after the open card it follows, in the section's order. */
async function openCards(keys: KeyringBody['keys'], grant: string) {
  const holder = document.querySelector<HTMLElement>('[data-sealed-cards]');
  const list = document.querySelector<HTMLElement>('[data-cards]');
  if (!holder || !list) return;
  const lastAfter = new Map<string, Element>();
  let added = 0;
  for (const tpl of holder.querySelectorAll<HTMLTemplateElement>('template[data-sealed="card"]')) {
    const p = await decrypt(tpl, keys, 'card');
    if (!p) continue;
    const box = document.createElement('div');
    box.innerHTML = p.html;
    const card = box.firstElementChild;
    if (!card) continue;
    const anchorKey = p.after ?? '';
    const anchor = lastAfter.get(anchorKey) ?? (p.after ? list.querySelector(`:scope > [data-node="${CSS.escape(p.after)}"]`) : null);
    if (anchor) anchor.after(card);
    else if (p.after) list.append(card);
    else list.prepend(card);
    lastAfter.set(anchorKey, card);
    card.setAttribute('data-shared', '');
    activateScripts(card);
    watchMedia(card, p.media);
    tpl.remove();
    added++;
  }
  if (added) {
    document.querySelector<HTMLElement>('[data-cards-empty]')?.setAttribute('hidden', '');
    say('cards', null, { cards: added });
    tell('access_opened', { grant, place: location.pathname.slice(base.length), cards: added });
  }
}

/** A private page the grant covers, swapped in where its sealed template was. */
async function openPage(keys: KeyringBody['keys'], grant: string, via: Session['via']): Promise<boolean> {
  const tpl = document.querySelector<HTMLTemplateElement>('template[data-sealed="main"]');
  if (!tpl) return false;
  const gate = document.querySelector<HTMLElement>('[data-access-gate]');
  const t0 = performance.now();
  const p = await decrypt(tpl, keys, 'main');
  if (!p) {
    gate?.removeAttribute('hidden');
    if (gate) gate.dataset.shown = '';
    say(via === 'link' ? 'link-not-cover' : 'not-shared', gate);
    return false;
  }
  tpl.insertAdjacentHTML('afterend', p.html);
  const main = tpl.parentElement!;
  tpl.remove();
  activateScripts(main);
  gate?.setAttribute('hidden', '');
  const title = main.querySelector<HTMLElement>('[data-page-title]')?.textContent;
  if (title) document.title = title;
  html.dataset.unlocked = '';
  watchMedia(main, p.media);
  // every component's script sets up the new elements, as on an open page (scripts/page.ts `each`)
  document.dispatchEvent(new Event('astro:page-load'));
  performance.measure('access:swap', { start: t0 });
  main.querySelector<HTMLElement>('h1')?.setAttribute('tabindex', '-1');
  main.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true });
  say('opened', null);
  tell('access_opened', { grant, place: location.pathname.slice(base.length) });
  return true;
}

function showBar(s: Session) {
  const bar = document.querySelector<HTMLElement>('[data-access-bar]');
  if (!bar) return;
  const until = bar.querySelector<HTMLElement>('[data-access-until]');
  if (until) until.textContent = untilWords(s.expiresAt);
  bar.hidden = false;
}

/** Applies a signed-in session to this page: the bar, the cards, the page; or says why it can't. */
async function apply(s: Session, where: Element | null): Promise<boolean> {
  const r = await keyring(s);
  if (!r.ok) {
    forget();
    say(r.outcome, where ?? document.querySelector('[data-access-gate]') ?? document.querySelector('[data-sign-in-line]'), { expiresAt: r.expiresAt });
    tell('access_failed', { reason: r.outcome });
    return false;
  }
  showBar(s);
  document.querySelector<HTMLElement>('[data-sign-in-line]')?.setAttribute('hidden', '');
  await openCards(r.body.keys, s.grant);
  await openPage(r.body.keys, s.grant, s.via);
  return true;
}

async function signInWithCode(form: HTMLFormElement, panel: HTMLElement) {
  const input = form.querySelector<HTMLInputElement>('input[name="code"]')!;
  const remember = form.querySelector<HTMLInputElement>('input[name="remember"]')?.checked ?? false;
  const fail = (outcome: Outcome, expiresAt?: string) => {
    say(outcome, panel, { expiresAt });
    input.setAttribute('aria-invalid', 'true');
    const status = panel.querySelector('[data-unlock-status]');
    if (status?.id) input.setAttribute('aria-describedby', status.id);
    input.focus();
    tell('access_failed', { reason: outcome });
  };
  const parsed = parseCode(input.value);
  if (!parsed) return fail('wrong');
  const lookup = `c/${parsed.name}`;
  performance.mark('access:sign-in');
  let res: Response;
  try {
    res = await fetch(`${base}/_access/${build()}/${lookup}.json`, { cache: 'no-store' });
  } catch {
    return fail('offline');
  }
  if (!res.ok) return fail(res.status === 404 ? 'wrong' : 'offline');
  try {
    const text = await res.text();
    const env = checkEnvelope(JSON.parse(text), text.length);
    const kek = await deriveCodeKey(parsed.secret, b64.decode(env.salt));
    const body = await openKeyring(kek, lookup, env);
    performance.measure('access:derive', 'access:sign-in');
    const s: Session = { v: 1, grant: body.grant, lookup, kek: b64.encode(kek), via: 'code', ...(body.expiresAt ? { expiresAt: body.expiresAt } : {}) };
    keep(s, remember);
    input.value = '';
    input.removeAttribute('aria-invalid');
    tell('access_signed_in', { grant: s.grant, via: 'code' });
    const back = safeReturn(new URLSearchParams(location.search).get('return'), base);
    if (panel.closest('[data-access-gate]') || !back) {
      say('signed-in', panel);
      await apply(s, panel);
    } else location.assign(back);
  } catch (e) {
    if (e instanceof KeyringError && e.code === 'expired') return fail('expired', (e as KeyringError & { expiresAt?: string }).expiresAt);
    fail('wrong');
  }
}

/** A magic link: its secret read and taken out of the address bar at once, then signed in for the session. */
async function signInWithLink(link: { grant: string; secret: string }): Promise<Session | null> {
  history.replaceState(history.state, '', location.pathname + location.search + withoutSecret(location.hash));
  const lookup = `l/${link.grant}`;
  const where = document.querySelector('[data-access-gate]');
  let res: Response;
  try {
    res = await fetch(`${base}/_access/${build()}/${lookup}.json`, { cache: 'no-store' });
  } catch {
    say('offline', where);
    return null;
  }
  if (!res.ok) {
    say(res.status === 404 ? 'withdrawn' : 'offline', where);
    tell('access_failed', { reason: res.status === 404 ? 'withdrawn' : 'offline' });
    return null;
  }
  try {
    const text = await res.text();
    const env = checkEnvelope(JSON.parse(text), text.length);
    const kek = await deriveLinkKey(b64.decode(link.secret), b64.decode(env.salt));
    const body = await openKeyring(kek, lookup, env);
    const s: Session = { v: 1, grant: body.grant, lookup, kek: b64.encode(kek), via: 'link', ...(body.expiresAt ? { expiresAt: body.expiresAt } : {}) };
    keep(s, false);
    tell('access_signed_in', { grant: s.grant, via: 'link' });
    return s;
  } catch (e) {
    const outcome = e instanceof KeyringError && e.code === 'expired' ? 'expired' : 'withdrawn';
    say(outcome, where, { expiresAt: (e as { expiresAt?: string }).expiresAt });
    tell('access_failed', { reason: outcome });
    return null;
  }
}

/** Signs out here; other tabs hear it and do the same. Nothing decrypted stays, and Back can't bring it back. */
function signOut(broadcast: boolean) {
  const s = stored();
  forget();
  for (const u of blobs) URL.revokeObjectURL(u);
  blobs.clear();
  if (s) tell('access_signed_out', { grant: s.grant });
  if (broadcast) channel?.postMessage('signed-out');
  location.replace(afterSignOut(html.dataset.access, location.pathname) + location.search);
}

const channel = 'BroadcastChannel' in window ? new BroadcastChannel(STORE) : null;
let started = false;

export function start() {
  if (started) return;
  started = true;
  if (!globalThis.crypto?.subtle) {
    for (const p of document.querySelectorAll('[data-unlock-panel], [data-sign-in-line]')) say('unsupported', p);
    return;
  }
  channel?.addEventListener('message', (e) => e.data === 'signed-out' && signOut(false));
  window.addEventListener('storage', (e) => {
    if (e.key === STORE && e.newValue === null && html.dataset.signedIn !== undefined) signOut(false);
  });
  // a page brought back from the back-forward cache after signing out in another page is reloaded, sealed again
  window.addEventListener('pageshow', (e) => {
    if (e.persisted && html.dataset.unlocked !== undefined && !stored()) location.reload();
  });

  each<HTMLElement>('[data-unlock-panel]', (panel, signal) => {
    const form = panel.querySelector<HTMLFormElement>('[data-unlock-form]');
    const show = panel.querySelector<HTMLButtonElement>('[data-unlock-show]');
    const input = panel.querySelector<HTMLInputElement>('input[name="code"]');
    show?.addEventListener(
      'click',
      () => {
        if (!input) return;
        const plain = input.type === 'password';
        input.type = plain ? 'text' : 'password';
        show.setAttribute('aria-pressed', String(plain));
      },
      { signal },
    );
    form?.addEventListener(
      'submit',
      (e) => {
        e.preventDefault();
        const submit = form.querySelector<HTMLButtonElement>('[data-unlock-submit]');
        if (submit) submit.disabled = true;
        void signInWithCode(form, panel).finally(() => submit && (submit.disabled = false));
      },
      { signal },
    );
  });
  each<HTMLElement>('[data-access-bar]', (bar, signal) => {
    bar.querySelector('[data-access-sign-out]')?.addEventListener('click', () => signOut(true), { signal });
  });

  void (async () => {
    const link = parseFragment(location.hash);
    const s = (link && (await signInWithLink(link))) || stored();
    if (s) {
      // telemetry puts what follows on the grant's timeline (it never sees more than the grant's ID)
      tell('access_session', { grant: s.grant });
      await apply(s, null);
    } else if (html.dataset.signedIn !== undefined) delete html.dataset.signedIn;
  })();
}
