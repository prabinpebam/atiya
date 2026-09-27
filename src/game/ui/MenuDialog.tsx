/** The menu (settings, places, the classic site) and its How to play page, loaded on demand by the HUD. */
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

const Keys = ({ k }: { k: string }) => (
  <>
    {k.split(' ').map((x) => (
      <kbd key={x}>{x}</kbd>
    ))}
  </>
);

/** How to play (the notice board by the path to the Lighthouse, or the menu's Show controls): the controls and some tips. */
function HowToPlay({ controller }: { controller: GameController }) {
  const touch = useStore(controller.store, (s) => s.input === 'touch') ? controller.touch : null;
  return (
    <>
      <h2 id="menu-title">How to play</h2>
      <section aria-labelledby="help-move">
        <h3 id="help-move">Getting about</h3>
        {touch ? (
          touch.copy.hint.map((t) => <p key={t}>{t}</p>)
        ) : (
          <ul className="help-list">
            <li>
              <Keys k="W A S D" /> or the arrow keys: walk. Hold <Keys k="Shift" /> to run. Or click a place to walk there.
            </li>
            <li>
              Drag the planet to turn and tilt the view. <Keys k=", ." /> rotate it, <Keys k="PgUp PgDn" /> tilt it, <Keys k="N" /> faces north.
            </li>
            <li>
              <Keys k="H" />: back to the plaza, facing north.
            </li>
          </ul>
        )}
      </section>
      {!touch && (
        <section aria-labelledby="help-do">
          <h3 id="help-do">Doing things</h3>
          <ul className="help-list">
            <li>
              <Keys k="E" />: open a building's card, or use what the gold ring glows round (shake a tree, pick a flower, talk, sit down).
            </li>
            <li>
              <Keys k="Esc" />: close what's open, or stand up.
            </li>
            <li>
              <Keys k="I" />: the backpack. <Keys k="1" />–<Keys k="9" />: pick a hotbar slot. <Keys k="F" />: whistle for Chopper. <Keys k="M" />: the menu.
            </li>
            <li>
              In the backpack and the chest: drag stacks between slots, <Keys k="Shift" />-click moves a stack across, <Keys k="R" /> sorts.
            </li>
          </ul>
        </section>
      )}
      <section aria-labelledby="help-tips">
        <h3 id="help-tips">Tips</h3>
        <ul className="help-list">
          <li>Every building holds part of Prabin's work: walk up to one to see what's inside.</li>
          <li>Shake trees and pick flowers, keep what you find in the chest, and make things at the crafting table.</li>
          <li>Prabin's family lives by the pond, and Chopper is never far away. Say hello.</li>
        </ul>
      </section>
    </>
  );
}

export default function MenuDialog({ controller }: { controller: GameController }) {
  const menuOpen = useStore(controller.store, (s) => s.menuOpen);
  const help = menuOpen === 'help';
  const reducedSystem = useStore(controller.store, (s) => s.reducedMotionSystem);
  const reduced = useStore(controller.store, selectReducedMotion);
  const pauseAmbient = useStore(controller.store, (s) => s.pauseAmbient);
  const timeMode = useStore(controller.store, (s) => s.timeMode);
  const soundOn = useStore(controller.store, (s) => s.soundOn);
  const musicOn = useStore(controller.store, (s) => s.musicOn);
  const largeText = useStore(controller.store, (s) => s.largeText);
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
        {help ? (
          <HowToPlay controller={controller} />
        ) : (
          <>
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
                <input type="checkbox" checked={largeText} onChange={(e) => controller.setLargeText(e.currentTarget.checked)} data-testid="large-text" />
                Larger text
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
          </>
        )}
        <div className="actions">
          {!help && (
            <button type="button" className="btn" onClick={() => controller.openHelp()}>
              Show controls
            </button>
          )}
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
