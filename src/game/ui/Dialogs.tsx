import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import type { GameController } from '../controller';
import { withBase } from '../platform/base';
import { prefs } from '../platform/prefs';
import { faArrowUpRightFromSquare } from '@fortawesome/free-solid-svg-icons';
import { Icon } from './Icon';
import { Button, KeyCap } from './primitives';
import { Dialog } from './overlays';
import { focusLane, laneBeneath, overlayOpen } from './lanes';

const toClassic = () => prefs.setMode('classic');
const FROM = 'planet-frame';

/**
 * A landmark's preview card, near its building (spec §6). It loads with this chunk, as nothing shows it at
 * load (Hud.tsx's `Later`). It owns the focus lane only when nothing ranks above it (a conversation, a seat,
 * a target: lanes.ts); under a modal it stays mounted but hidden, so its Open button can take the focus back.
 */
export function PreviewCard({ controller }: { controller: GameController }) {
  const nearbyId = useStore(controller.store, (s) => s.nearbyId);
  const shown = useStore(controller.store, (s) => (focusLane(s) === 'preview' ? 'shown' : overlayOpen(s) && laneBeneath(s) === 'preview' ? 'hidden' : null));
  // near a building, its list is fetched ahead, so Open shows it at once (documentation/sections/spec.md §6.7)
  useEffect(() => {
    if (!nearbyId || document.querySelector(`link[data-prefetch="${nearbyId}"]`)) return;
    const l = document.createElement('link');
    l.rel = 'prefetch';
    l.href = withBase(`/play/${nearbyId}/`);
    l.dataset.prefetch = nearbyId;
    document.head.append(l);
  }, [nearbyId]);
  if (!nearbyId || !shown) return null;
  const d = controller.dataById.get(nearbyId)!;
  return (
    <section className="card preview-card lane" hidden={shown === 'hidden'} aria-labelledby="preview-title" style={{ ['--accent' as string]: d.accent }} data-testid="preview-card">
      <Button variant="bare" className="preview-row" aria-label={`Open ${d.title}`} onClick={(e) => controller.openLandmark(d.id, { invoker: e.currentTarget })}>
        <span className="preview-row-title">{d.title}</span>
        <span className="preview-row-action">Open</span>
      </Button>
      <div className="preview-full">
        <p className="kicker">{d.kicker}</p>
        <h2 id="preview-title">{d.title}</h2>
        <p>{d.summary}</p>
        {d.pages.length === 0 && <p>It’s still being fitted out: its pages are on their way.</p>}
        <div className="actions">
          <Button variant="primary" onClick={(e) => controller.openLandmark(d.id, { invoker: e.currentTarget })}>
            Open <KeyCap>E</KeyCap>
          </Button>
          <a className="btn" href={d.siteHref} onClick={toClassic}>
            Open classic page <Icon icon={faArrowUpRightFromSquare} />
          </a>
        </div>
      </div>
    </section>
  );
}

/** What shows if the 3D view is lost (the GPU dropped the canvas): reload, or go to the classic site. */
export function ContextLost({ controller }: { controller: GameController }) {
  const lost = useStore(controller.store, (s) => s.contextLost);
  if (!lost) return null;
  return (
    <div className="overlay" role="alertdialog" aria-labelledby="ctx-title">
      <div className="card center-card">
        <h2 id="ctx-title" className="card-title">
          The 3D view stopped working
        </h2>
        <div className="actions">
          <Button variant="primary" onClick={() => location.reload()}>
            Reload planet
          </Button>
          <a className="btn" href={controller.classicHref()} onClick={toClassic}>
            Classic site
          </a>
        </div>
      </div>
    </div>
  );
}

/** The site's theme (its own key: the game never imports the site), resolved to light or dark for the frame. */
function siteScheme(): 'light' | 'dark' {
  let t: string | null = null;
  try {
    t = localStorage.getItem('site.theme');
  } catch {
    /* no storage: the system's */
  }
  if (t === 'light' || t === 'dark') return t;
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * A building's reading overlay (documentation/sections/spec.md §6): its list and its pages are the site's
 * own pages, framed over the planet (/play/<building>/…), which paint the smoke and carry their own bar.
 * The overlay holds the frame, matches its colour scheme (a frame whose scheme differs from its parent's
 * gets an opaque backdrop, and its prefers-color-scheme follows this element's), hears only its own
 * frame's messages (§6.9), and shows a status while it loads and a way out if it fails. Loaded on demand,
 * like the menu.
 */
export default function LandmarkDialog({ controller }: { controller: GameController }) {
  const openId = useStore(controller.store, (s) => s.openId);
  const frame = useRef<HTMLIFrameElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [scheme, setScheme] = useState<'light' | 'dark'>('light');
  const [state, setState] = useState<'loading' | 'slow' | 'ready' | 'failed'>('loading');
  const [tries, setTries] = useState(0);
  // what the frame's first "ready" says instead of its own words (a page that wasn't in this building)
  const notice = useRef<string | null>(null);
  const shown = openId ? controller.dataById.get(openId) : undefined;

  useEffect(() => {
    if (openId) {
      const data = controller.dataById.get(openId);
      const asked = controller.openPage;
      // a page that isn't this building's (or isn't published) opens its list instead, and says so
      const page = asked && data?.pages.some((p) => p.id === asked) ? asked : null;
      notice.current = asked && !page && data ? `That page isn’t in the ${data.title}, so here’s what is.` : null;
      setScheme(siteScheme());
      setSrc(withBase(`/play/${openId}/${page ? `${page}/` : ''}`));
      setState('loading');
    } else {
      setSrc(null);
    }
  }, [openId, controller]);

  // a status after a moment, and a way out if the frame never says it's ready
  useEffect(() => {
    if (!src || (state !== 'loading' && state !== 'slow')) return;
    const slow = window.setTimeout(() => setState((s) => (s === 'loading' ? 'slow' : s)), 400);
    const fail = window.setTimeout(() => setState((s) => (s === 'ready' ? s : 'failed')), 10_000);
    return () => {
      window.clearTimeout(slow);
      window.clearTimeout(fail);
    };
  }, [src, state, tries]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const f = frame.current;
      if (!f || e.origin !== location.origin || e.source !== f.contentWindow) return;
      const m = e.data as { source?: string; type?: string; place?: string; page?: string | null; title?: string; heading?: string; scheme?: string; index?: number | null; count?: number | null };
      if (m?.source !== FROM || typeof m.type !== 'string' || typeof m.place !== 'string') return;
      // a message from a building that's no longer open belongs to an overlay that's closing
      if (m.place !== controller.store.getState().openId) return;
      if (m.type === 'planet:ready') {
        const data = controller.dataById.get(m.place);
        setState('ready');
        if (typeof m.title === 'string') f.title = m.title;
        if (m.scheme === 'light' || m.scheme === 'dark') setScheme(m.scheme);
        const where = data ? `the ${data.title}` : 'this building';
        const said = notice.current ?? (m.page && typeof m.index === 'number' && typeof m.count === 'number' ? `${m.heading}. Page ${m.index + 1} of ${m.count} in ${where}.` : `${data?.title ?? ''}: what’s inside.`);
        notice.current = null;
        controller.readingAt(m.place, typeof m.page === 'string' ? m.page : null, said);
        f.focus();
        f.contentWindow?.postMessage({ source: 'planet-game', type: 'planet:focus' }, location.origin);
      } else if (m.type === 'planet:close') controller.requestCloseLandmark();
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [controller]);

  const retry = () => {
    setState('loading');
    setTries((n) => n + 1);
  };

  return (
    <Dialog bare open={Boolean(openId)} onDismiss={() => controller.requestCloseLandmark()} className="reading-overlay" aria-label={shown?.title ?? 'Reading'} data-testid="landmark-dialog">
      {src && <iframe key={`${src}#${tries}`} ref={frame} className="reading-frame" src={src} title={shown?.title ?? 'Reading'} data-scheme={scheme} data-ready={state === 'ready' ? '' : undefined} data-testid="reading-frame" />}
      {state === 'slow' && shown && (
        <p className="card reading-status" role="status">
          Opening the {shown.title}…
        </p>
      )}
      {state === 'failed' && shown && (
        <div className="card reading-failed" role="alert">
          <p className="card-title">The {shown.title} didn’t open.</p>
          <p>Try again, or read it on the classic site.</p>
          <div className="actions">
            <Button variant="primary" onClick={retry}>
              Try again
            </Button>
            <a className="btn" href={controller.classicHref()} onClick={toClassic}>
              Open classic page <Icon icon={faArrowUpRightFromSquare} />
            </a>
            <Button onClick={() => controller.requestCloseLandmark()}>
              Close <KeyCap>Space</KeyCap>
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
