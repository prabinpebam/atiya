import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import type { GameController } from '../controller';
import { withBase } from '../platform/base';
import { prefs } from '../platform/prefs';
import { faArrowUpRightFromSquare } from '@fortawesome/free-solid-svg-icons';
import { Icon } from './Icon';
import { spaceBack } from '../input/keyboard';

const toClassic = () => prefs.setMode('classic');
const FROM = 'planet-frame';

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
  const ref = useRef<HTMLDialogElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [scheme, setScheme] = useState<'light' | 'dark'>('light');
  const [state, setState] = useState<'loading' | 'slow' | 'ready' | 'failed'>('loading');
  const [tries, setTries] = useState(0);
  // what the frame's first "ready" says instead of its own words (a page that wasn't in this building)
  const notice = useRef<string | null>(null);
  const shown = openId ? controller.dataById.get(openId) : undefined;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (openId) {
      const data = controller.dataById.get(openId);
      const asked = controller.openPage;
      // a page that isn't this building's (or isn't published) opens its list instead, and says so
      const page = asked && data?.pages.some((p) => p.id === asked) ? asked : null;
      notice.current = asked && !page && data ? `That page isn’t in the ${data.title}, so here’s what is.` : null;
      setScheme(siteScheme());
      setSrc(withBase(`/play/${openId}/${page ? `${page}/` : ''}`));
      setState('loading');
      if (!d.open) d.showModal();
    } else {
      if (d.open) d.close();
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
    <dialog
      ref={ref}
      className="reading-overlay"
      aria-label={shown?.title ?? 'Reading'}
      data-testid="landmark-dialog"
      onCancel={(e) => {
        e.preventDefault();
        controller.requestCloseLandmark();
      }}
      onKeyDown={(e) => {
        if (!spaceBack(e)) return;
        e.preventDefault();
        controller.requestCloseLandmark();
      }}
    >
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
            <button className="btn primary" type="button" onClick={retry}>
              Try again
            </button>
            <a className="btn" href={controller.classicHref()} onClick={toClassic}>
              Open classic page <Icon icon={faArrowUpRightFromSquare} />
            </a>
            <button className="btn" type="button" onClick={() => controller.requestCloseLandmark()}>
              Close <kbd>Space</kbd>
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
