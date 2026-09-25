import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from 'zustand';
import type { GameController } from '../controller';
import { classicHrefFor } from '../platform/url';
import { prefs } from '../platform/prefs';
import { SUNRISE, SUNSET, formatHours } from '../world/timeOfDay';
import { LandmarkDialog, MenuDialog } from './Dialogs';
import { ViewControls } from './ViewControls';

const toClassic = () => prefs.setMode('classic');

function LoadingOverlay({ controller }: { controller: GameController }) {
  const phase = useStore(controller.store, (s) => s.phase);
  if (phase !== 'loading') return null;
  return (
    <div className="overlay" role="status">
      <div className="card center-card">
        <p className="card-title">Loading the planet…</p>
        <p>
          Prefer a normal website?{' '}
          <a href="/classic/" onClick={toClassic}>
            Go to the classic site
          </a>
        </p>
      </div>
    </div>
  );
}

function StartOverlay({ controller }: { controller: GameController }) {
  const phase = useStore(controller.store, (s) => s.phase);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    // Only take focus when nothing else has it (never steal focus).
    if (phase === 'ready' && (document.activeElement === document.body || document.activeElement === null)) btn.current?.focus();
  }, [phase]);
  if (phase !== 'ready') return null;
  return (
    <div className="overlay start-overlay">
      <div className="card center-card" role="group" aria-labelledby="start-title">
        <h1 id="start-title" className="card-title">
          Welcome to the little planet
        </h1>
        <p>Walk with W A S D or the arrow keys. Walk up to a building to see what's inside, then press E.</p>
        <button ref={btn} className="btn primary big" type="button" onClick={() => controller.start()}>
          Start exploring
        </button>
        <p className="muted">
          Prefer a normal website?{' '}
          <a href="/classic/" onClick={toClassic}>
            Classic site
          </a>
        </p>
      </div>
    </div>
  );
}

function PreviewCard({ controller }: { controller: GameController }) {
  const nearbyId = useStore(controller.store, (s) => s.nearbyId);
  const visible = useStore(controller.store, (s) => s.phase === 'playing' && !s.traveling);
  if (!nearbyId || !visible) return null;
  const d = controller.dataById.get(nearbyId)!;
  return (
    <section className="card preview-card" aria-labelledby="preview-title" style={{ ['--accent' as string]: d.accent }} data-testid="preview-card">
      <p className="kicker">{d.kicker}</p>
      <h2 id="preview-title">{d.title}</h2>
      <p>{d.summary}</p>
      <div className="actions">
        <button className="btn primary" type="button" onClick={(e) => controller.openLandmark(d.id, { invoker: e.currentTarget })}>
          Open <kbd>E</kbd>
        </button>
        <a className="btn" href={classicHrefFor(d.id)} onClick={toClassic}>
          Classic page <span aria-hidden="true">↗</span>
        </a>
      </div>
    </section>
  );
}

function ControlsHint({ controller }: { controller: GameController }) {
  const show = useStore(controller.store, (s) => s.hintVisible && s.phase === 'playing');
  if (!show) return null;
  return (
    <aside className="card hint" aria-label="Controls" data-testid="controls-hint">
      <p>
        <kbd>W</kbd>
        <kbd>A</kbd>
        <kbd>S</kbd>
        <kbd>D</kbd> / arrows to move · <kbd>Shift</kbd> run · <kbd>E</kbd> open · <kbd>M</kbd> map
      </p>
      <p>
        Drag to turn &amp; tilt the view · <kbd>,</kbd>
        <kbd>.</kbd> rotate · <kbd>PgUp</kbd>
        <kbd>PgDn</kbd> tilt · <kbd>N</kbd> north · <kbd>H</kbd> reset
      </p>
      <p className="muted">
        Prefer a normal website?{' '}
        <a href="/classic/" onClick={toClassic}>
          Classic site
        </a>
      </p>
    </aside>
  );
}

function Toast({ controller }: { controller: GameController }) {
  const toast = useStore(controller.store, (s) => s.toast);
  if (!toast) return null;
  return (
    <div className="toast" aria-hidden="true">
      {toast}
    </div>
  );
}

function LiveRegion({ controller }: { controller: GameController }) {
  const text = useStore(controller.store, (s) => s.announcement);
  return (
    <div className="sr-only" role="status" aria-live="polite" data-testid="live-region">
      {text}
    </div>
  );
}

/** Parallel DOM navigation: every landmark reachable without the canvas (spec §6). */
function LandmarkNav({ controller }: { controller: GameController }) {
  const phase = useStore(controller.store, (s) => s.phase);
  if (phase === 'loading') return null;
  return (
    <nav className="landmark-nav" aria-label="Planet landmarks">
      <h2>Travel to a place</h2>
      <ul>
        {controller.landmarks.map((l) => (
          <li key={l.id}>
            <button type="button" className="btn" onClick={() => controller.travelTo(l.id)}>
              {l.title} — {l.kicker}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Little planet clock (updates every few seconds; not a live region). */
function TimeBadge({ controller }: { controller: GameController }) {
  const [hours, setHours] = useState(controller.timeOfDay);
  useEffect(() => {
    const id = window.setInterval(() => setHours(controller.timeOfDay), 1000);
    return () => window.clearInterval(id);
  }, [controller]);
  const night = hours < SUNRISE || hours >= SUNSET;
  const text = formatHours(hours);
  return (
    <span className="time-badge" data-testid="time-badge" title="Planet time">
      <span aria-hidden="true">{night ? '☾' : '☀'}</span>
      <span className="sr-only">Planet time </span>
      {text}
    </span>
  );
}

/** Sound on/off (a toggle button: its name stays "Sound", the pressed state carries on/off). */
function SoundButton({ controller }: { controller: GameController }) {
  const on = useStore(controller.store, (s) => s.soundOn);
  return (
    <button
      type="button"
      className="btn sound-btn"
      aria-pressed={on}
      title={on ? 'Sound on — click to mute' : 'Sound off — click to unmute'}
      onClick={() => controller.setSound(!on)}
      data-testid="sound-button"
    >
      <span aria-hidden="true">{on ? '🔊' : '🔇'}</span>
      <span className="sound-label">Sound</span>
    </button>
  );
}

function MenuButton({ controller, target }: { controller: GameController; target: HTMLElement | null }) {
  const phase = useStore(controller.store, (s) => s.phase);
  if (!target || phase === 'loading') return null;
  return createPortal(
    <>
      <TimeBadge controller={controller} />
      <SoundButton controller={controller} />
      <button type="button" className="btn" aria-haspopup="dialog" onClick={() => controller.openMenu()} data-testid="menu-button">
        Menu
      </button>
    </>,
    target,
  );
}

function ContextLost({ controller }: { controller: GameController }) {
  const lost = useStore(controller.store, (s) => s.contextLost);
  if (!lost) return null;
  return (
    <div className="overlay" role="alertdialog" aria-labelledby="ctx-title">
      <div className="card center-card">
        <h2 id="ctx-title" className="card-title">
          The 3D view stopped working
        </h2>
        <div className="actions">
          <button className="btn primary" type="button" onClick={() => location.reload()}>
            Reload planet
          </button>
          <a className="btn" href={controller.classicHref()} onClick={toClassic}>
            Classic site
          </a>
        </div>
      </div>
    </div>
  );
}

export function Hud({ controller }: { controller: GameController }) {
  return (
    <>
      <LandmarkNav controller={controller} />
      <PreviewCard controller={controller} />
      <ViewControls controller={controller} />
      <ControlsHint controller={controller} />
      <Toast controller={controller} />
      <LiveRegion controller={controller} />
      <div
        className="fade-overlay"
        aria-hidden="true"
        ref={(el) => {
          controller.fadeEl.current = el;
        }}
      />
      <LandmarkDialog controller={controller} />
      <MenuDialog controller={controller} />
      <MenuButton controller={controller} target={controller.hudActions} />
      <LoadingOverlay controller={controller} />
      <StartOverlay controller={controller} />
      <ContextLost controller={controller} />
    </>
  );
}
