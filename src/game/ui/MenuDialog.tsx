/** The menu (settings, the classic site), its How to play page and its fast travel page, loaded on demand by the HUD. */
import { useEffect, useRef, type KeyboardEvent } from 'react';
import { faBookOpen, faEnvelope, faHouse, faLandmark, faMicrophoneLines, faScrewdriverWrench, faSeedling, faTowerObservation, type IconDefinition } from '@fortawesome/free-solid-svg-icons';
import { Icon } from './Icon';
import { useStore } from 'zustand';
import type { GameController } from '../controller';
import { prefs } from '../platform/prefs';
import { selectAmbientPaused, selectReducedMotion } from '../state/store';
import type { TimeMode } from '../world/timeOfDay';
import { spaceBack } from '../input/keyboard';

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

/** Each place's sign on its fast travel tile (a landmark without one gets the town hall's). */
const PLACE_ICONS: Record<string, IconDefinition> = {
  workshop: faScrewdriverWrench,
  'town-hall': faLandmark,
  lighthouse: faTowerObservation,
  library: faBookOpen,
  amphitheater: faMicrophoneLines,
  greenhouse: faSeedling,
  'post-office': faEnvelope,
};

/**
 * Fast travel (T, or the header's button): every place as a tile, with its sign, name and what's inside,
 * and a number key (the plaza is H). Arrow keys go from tile to tile; Enter or the number flies there;
 * T, Space or Esc closes. Where you are is marked.
 */
function TravelPage({ controller }: { controller: GameController }) {
  const nearby = useStore(controller.store, (s) => s.nearbyId);
  // (read as the page opens: you're not moving while it's up)
  const atSpawn = controller.isAtSpawn();
  const grid = useRef<HTMLUListElement>(null);
  const places = [...controller.landmarks].sort((a, b) => a.order - b.order);
  // arrow keys: the next tile along, or the nearest one in the row above or below
  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    const tiles = Array.from(grid.current?.querySelectorAll<HTMLButtonElement>('.travel-tile') ?? []);
    const i = tiles.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    let next = -1;
    if (e.code === 'ArrowRight') next = Math.min(tiles.length - 1, i + 1);
    else if (e.code === 'ArrowLeft') next = Math.max(0, i - 1);
    else if (e.code === 'ArrowDown' || e.code === 'ArrowUp') {
      const r = tiles.map((t) => t.getBoundingClientRect());
      const down = e.code === 'ArrowDown';
      const row = r.filter((b) => (down ? b.top > r[i].top + 4 : b.top < r[i].top - 4));
      if (!row.length) return e.preventDefault();
      const top = down ? Math.min(...row.map((b) => b.top)) : Math.max(...row.map((b) => b.top));
      const cx = r[i].left + r[i].width / 2;
      next = r.reduce((best, b, k) => (Math.abs(b.top - top) < 4 && (best < 0 || Math.abs(b.left + b.width / 2 - cx) < Math.abs(r[best].left + r[best].width / 2 - cx)) ? k : best), -1);
    } else return;
    e.preventDefault();
    tiles[next]?.focus();
  };
  return (
    <>
      <h2 id="menu-title">Fast travel</h2>
      <p className="muted travel-lead">Pick a place and fly there.</p>
      <ul ref={grid} className="travel-grid" onKeyDown={onKeyDown}>
        {places.map((l, i) => (
          <li key={l.id}>
            <button
              type="button"
              className="travel-tile"
              style={{ ['--accent' as string]: l.accent }}
              aria-current={nearby === l.id ? 'location' : undefined}
              aria-keyshortcuts={String(i + 1)}
              onClick={() => controller.travelTo(l.id)}
            >
              <span className="travel-sign" aria-hidden="true">
                <Icon icon={PLACE_ICONS[l.id] ?? faLandmark} />
              </span>
              <strong>{l.title}</strong>
              <span className="travel-kicker">{l.kicker}</span>
              {nearby === l.id && <span className="travel-here">You're here</span>}
              <kbd>{i + 1}</kbd>
            </button>
          </li>
        ))}
        <li>
          <button type="button" className="travel-tile plaza" aria-current={atSpawn ? 'location' : undefined} aria-keyshortcuts="H" onClick={() => controller.returnHome()}>
            <span className="travel-sign" aria-hidden="true">
              <Icon icon={faHouse} />
            </span>
            <strong>The plaza</strong>
            <span className="travel-kicker">Where you started, facing north</span>
            {atSpawn && <span className="travel-here">You're here</span>}
            <kbd>H</kbd>
          </button>
        </li>
      </ul>
    </>
  );
}

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
              <Keys k="Space" />: close what's open, stand up or stop talking; otherwise, jump. <Keys k="Enter" /> presses the chosen button.
            </li>
            <li>
              <Keys k="X" />: sit on the grass. <Keys k="Z" />: lie back and look at the sky. The same key, <Keys k="Space" /> or a step gets you up.
            </li>
            <li>
              <Keys k="I" /> or <Keys k="B" />: open or close the backpack. <Keys k="1" />–<Keys k="9" />: pick a hotbar slot. <Keys k="F" />: whistle for Chopper.
            </li>
            <li>
              <Keys k="T" />: fast travel, every place as a tile (its number flies there). <Keys k="M" />: the menu.
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
          <li>Each building will hold part of Prabin's work. Most are still being fitted out: walk up to one to see what's there so far.</li>
          <li>Shake trees and pick flowers, keep what you find in the chest, and make things at the crafting table.</li>
          <li>Dig clay on the banks and build a furnace: it smelts iron ore into ingots for nails.</li>
          <li>Prabin's family lives by the pond, and Chopper is never far away. Say hello.</li>
          <li>At night, pick your lantern in the hotbar to light the way. Sit or lie down anywhere from the menu's Rest group.</li>
        </ul>
      </section>
    </>
  );
}

export default function MenuDialog({ controller }: { controller: GameController }) {
  const menuOpen = useStore(controller.store, (s) => s.menuOpen);
  const help = menuOpen === 'help';
  const travel = menuOpen === 'travel';
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
      className={`dialog menu-dialog${travel ? ' travel-dialog' : ''}`}
      aria-labelledby="menu-title"
      data-testid="menu-dialog"
      onCancel={(e) => {
        e.preventDefault();
        controller.closeMenu();
      }}
      onKeyDown={(e) => {
        // fast travel's keys: a place's number (the plaza is H) flies there; T closes, as it opened
        if (travel && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const n = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
          const place = n ? [...controller.landmarks].sort((a, b) => a.order - b.order)[Number(n[1]) - 1] : undefined;
          if (place || e.code === 'KeyH' || e.code === 'KeyT') {
            e.preventDefault();
            if (place) controller.travelTo(place.id);
            else if (e.code === 'KeyH') controller.returnHome();
            else controller.closeMenu();
            return;
          }
        }
        if (!spaceBack(e)) return;
        e.preventDefault();
        controller.closeMenu();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) controller.closeMenu();
      }}
    >
      <div className="dialog-body">
        {travel ? (
          <TravelPage controller={controller} />
        ) : help ? (
          <HowToPlay controller={controller} />
        ) : (
          <>
            <h2 id="menu-title">Menu</h2>
            <section aria-labelledby="menu-places">
              <h3 id="menu-places">Places</h3>
              <button type="button" className="btn" onClick={() => controller.openTravel()}>
                Fast travel <kbd>T</kbd>
              </button>
            </section>
            <section aria-labelledby="menu-view">
              <h3 id="menu-view">View</h3>
              <div className="menu-view" role="group" aria-label="Turn and tilt the view">
                <button type="button" className="btn" onClick={() => controller.rotateViewStep(1)}>
                  Rotate left <kbd>,</kbd>
                </button>
                <button type="button" className="btn" onClick={() => controller.rotateViewStep(-1)}>
                  Rotate right <kbd>.</kbd>
                </button>
                <button type="button" className="btn" onClick={() => controller.tiltViewStep(1)}>
                  Tilt to top <kbd>PgUp</kbd>
                </button>
                <button type="button" className="btn" onClick={() => controller.tiltViewStep(-1)}>
                  Tilt to side <kbd>PgDn</kbd>
                </button>
              </div>
            </section>
            <section aria-labelledby="menu-rest">
              <h3 id="menu-rest">Rest</h3>
              <div className="menu-view" role="group" aria-label="Rest here">
                {(['sit', 'lie'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    className="btn"
                    onClick={() => {
                      controller.closeMenu();
                      controller.restAs?.(k);
                    }}
                  >
                    {k === 'sit' ? 'Sit down' : 'Lie down'} <kbd>{k === 'sit' ? 'X' : 'Z'}</kbd>
                  </button>
                ))}
              </div>
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
          {!help && !travel && (
            <button type="button" className="btn" onClick={() => controller.openHelp()}>
              Show controls
            </button>
          )}
          <a className="btn" href={controller.classicHref()} onClick={toClassic}>
            Classic site
          </a>
          <button type="button" className="btn primary" onClick={() => controller.closeMenu()}>
            Close <kbd>Space</kbd>
          </button>
        </div>
      </div>
    </dialog>
  );
}
