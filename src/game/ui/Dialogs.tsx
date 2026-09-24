import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import type { GameController } from '../controller';
import type { LandmarkData } from '../types';
import { classicHrefFor } from '../platform/url';
import { prefs } from '../platform/prefs';
import { selectReducedMotion } from '../state/store';

const toClassic = () => prefs.setMode('classic');

export function LandmarkDialog({ controller }: { controller: GameController }) {
  const openId = useStore(controller.store, (s) => s.openId);
  const ref = useRef<HTMLDialogElement>(null);
  const [shown, setShown] = useState<LandmarkData | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (openId) {
      setShown(controller.dataById.get(openId) ?? null);
      if (!d.open) d.showModal();
    } else if (d.open) {
      d.close();
    }
  }, [openId, controller]);

  return (
    <dialog
      ref={ref}
      className="dialog landmark-dialog"
      aria-labelledby="landmark-dialog-title"
      data-testid="landmark-dialog"
      style={{ ['--accent' as string]: shown?.accent ?? '#4f7cff' }}
      onCancel={(e) => {
        e.preventDefault();
        controller.requestCloseLandmark();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) controller.requestCloseLandmark();
      }}
    >
      {shown && (
        <article className="dialog-body">
          <p className="kicker">{shown.kicker}</p>
          <h2 id="landmark-dialog-title">{shown.title}</h2>
          <p>{shown.dialog.intro}</p>
          {shown.dialog.highlights.length > 0 && (
            <ul>
              {shown.dialog.highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          )}
          <div className="actions">
            <a className="btn primary" href={classicHrefFor(shown.id)} onClick={toClassic}>
              Open full page <span aria-hidden="true">↗</span>
            </a>
            <button className="btn" type="button" onClick={() => controller.requestCloseLandmark()}>
              Close
            </button>
          </div>
        </article>
      )}
    </dialog>
  );
}

export function MenuDialog({ controller }: { controller: GameController }) {
  const menuOpen = useStore(controller.store, (s) => s.menuOpen);
  const reducedSystem = useStore(controller.store, (s) => s.reducedMotionSystem);
  const reduced = useStore(controller.store, selectReducedMotion);
  const pauseAmbient = useStore(controller.store, (s) => s.pauseAmbient);
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
