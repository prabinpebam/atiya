/** The menu (settings, places, the classic site), loaded on demand by the HUD. */
import { useEffect, useRef } from 'react';
import { useStore } from 'zustand';
import type { GameController } from '../controller';
import { prefs } from '../platform/prefs';
import { selectAmbientPaused, selectReducedMotion } from '../state/store';
import type { TimeMode } from '../world/timeOfDay';

const toClassic = () => prefs.setMode('classic');

const TIME_OPTIONS: ReadonlyArray<readonly [TimeMode, string]> = [
  ['cycle', 'Day–night cycle (a day every ~6 minutes)'],
  ['local', 'Match my local time'],
  ['day', 'Always daytime'],
];

export default function MenuDialog({ controller }: { controller: GameController }) {
  const menuOpen = useStore(controller.store, (s) => s.menuOpen);
  const reducedSystem = useStore(controller.store, (s) => s.reducedMotionSystem);
  const reduced = useStore(controller.store, selectReducedMotion);
  const pauseAmbient = useStore(controller.store, (s) => s.pauseAmbient);
  const timeMode = useStore(controller.store, (s) => s.timeMode);
  const soundOn = useStore(controller.store, (s) => s.soundOn);
  const musicOn = useStore(controller.store, (s) => s.musicOn);
  const ambientPaused = useStore(controller.store, selectAmbientPaused);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (menuOpen && !d.open) d.showModal();
    if (!menuOpen && d.open) d.close();
  }, [menuOpen]);

  return (
    <dialog
      ref={ref}
      className="dialog menu-dialog"
      aria-labelledby="menu-title"
      data-testid="menu-dialog"
      onCancel={(e) => {
        e.preventDefault();
        controller.closeMenu();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) controller.closeMenu();
      }}
    >
      <div className="dialog-body">
        <h2 id="menu-title">Menu</h2>
        <section aria-labelledby="menu-places">
          <h3 id="menu-places">Travel to</h3>
          <ul className="menu-list">
            {controller.landmarks.map((l) => (
              <li key={l.id}>
                <button type="button" className="btn menu-item" style={{ ['--accent' as string]: l.accent }} onClick={() => controller.travelTo(l.id)}>
                  <span className="dot" aria-hidden="true" />
                  <span>
                    <strong>{l.title}</strong> <span className="muted">{l.kicker}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="menu-settings">
          <h3 id="menu-settings">Settings</h3>
          <label className="check">
            <input
              type="checkbox"
              checked={reduced}
              disabled={reducedSystem}
              onChange={(e) => controller.setReduceMotion(e.currentTarget.checked)}
            />
            Reduce motion{reducedSystem ? ' (on in your system settings)' : ''}
          </label>
          <label className="check">
            <input type="checkbox" checked={pauseAmbient || reduced} disabled={reduced} onChange={(e) => controller.setPauseAmbient(e.currentTarget.checked)} />
            Pause ambient motion
          </label>
          <label className="check">
            <input type="checkbox" checked={soundOn} onChange={(e) => controller.setSound(e.currentTarget.checked)} />
            Sound effects
          </label>
          <label className="check">
            <input type="checkbox" checked={musicOn} onChange={(e) => controller.setMusic(e.currentTarget.checked)} />
            Background music
          </label>
          <fieldset className="radio-group">
            <legend>Time of day</legend>
            {TIME_OPTIONS.map(([value, label]) => (
              <label key={value} className="check">
                <input type="radio" name="time-mode" value={value} checked={timeMode === value} onChange={() => controller.setTimeMode(value)} />
                {label}
              </label>
            ))}
            {timeMode === 'cycle' && ambientPaused && <p className="muted">The cycle is paused while ambient motion is paused.</p>}
          </fieldset>
        </section>
        <div className="actions">
          <button type="button" className="btn" onClick={() => controller.showControls()}>
            Show controls
          </button>
          <a className="btn" href={controller.classicHref()} onClick={toClassic}>
            Classic site
          </a>
          <button type="button" className="btn primary" onClick={() => controller.closeMenu()}>
            Close
          </button>
        </div>
      </div>
    </dialog>
  );
}
