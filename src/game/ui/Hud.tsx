import { Suspense, lazy, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from 'zustand';
import type { GameController } from '../controller';
import { prefs } from '../platform/prefs';
import { SUNRISE, SUNSET, formatHours, wrapHours } from '../world/timeOfDay';
import { ViewControls } from './ViewControls';
import { CHARACTERS, type CharacterId } from '../player/characters';
import {
  faArrowUpRightFromSquare,
  faBars,
  faBoxOpen,
  faBreadSlice,
  faChair,
  faClipboardList,
  faComment,
  faHammer,
  faLocationDot,
  faMoon,
  faPaw,
  faPersonWalking,
  faSeedling,
  faSun,
  faTree,
  faVolumeHigh,
  faVolumeXmark,
} from '@fortawesome/free-solid-svg-icons';
import { Hotbar, InventoryScreen } from './Inventory';
import { Icon } from './Icon';
import { withBase } from '../platform/base';
import { focusLane, laneBeneath, overlayOpen } from './lanes';

const toClassic = () => prefs.setMode('classic');

function PreviewCard({ controller }: { controller: GameController }) {
  const nearbyId = useStore(controller.store, (s) => s.nearbyId);
  // it owns the focus lane only when nothing ranks above it (a conversation, a seat, a target: lanes.ts);
  // under a modal it stays mounted but hidden, so its Open button can take the focus back on close
  const shown = useStore(controller.store, (s) => (focusLane(s) === 'preview' ? 'shown' : overlayOpen(s) && laneBeneath(s) === 'preview' ? 'hidden' : null));
  if (!nearbyId || !shown) return null;
  const d = controller.dataById.get(nearbyId)!;
  return (
    <section className="card preview-card lane" hidden={shown === 'hidden'} aria-labelledby="preview-title" style={{ ['--accent' as string]: d.accent }} data-testid="preview-card">
      <p className="kicker">{d.kicker}</p>
      <h2 id="preview-title">{d.title}</h2>
      <p>{d.summary}</p>
      {d.pages.length === 0 && <p>It’s still being fitted out: its pages are on their way.</p>}
      <div className="actions">
        <button className="btn primary" type="button" onClick={(e) => controller.openLandmark(d.id, { invoker: e.currentTarget })}>
          Open <kbd>E</kbd>
        </button>
        <a className="btn" href={d.siteHref} onClick={toClassic}>
          Open classic page <Icon icon={faArrowUpRightFromSquare} />
        </a>
      </div>
    </section>
  );
}

// (the targets a chunk adds bring their own icon: the crafting table, the site, the watering can, the plants)
const TARGET_ICONS = { tree: faTree, boulder: faHammer, flower: faSeedling, chest: faBoxOpen, bench: faChair, dog: faPaw, npc: faComment, notice: faClipboardList } as const;

// the menu and a landmark's dialog load on demand: the first time they're opened, or soon after the game starts
const MenuDialog = lazy(() => import('./MenuDialog'));
const LandmarkDialog = lazy(() => import('./Dialogs'));

function LandmarkDialogSlot({ controller }: { controller: GameController }) {
  const open = useStore(controller.store, (s) => Boolean(s.openId));
  return <Later controller={controller} open={open} Screen={LandmarkDialog} />;
}

function MenuDialogSlot({ controller }: { controller: GameController }) {
  const open = useStore(controller.store, (s) => Boolean(s.menuOpen));
  return <Later controller={controller} open={open} Screen={MenuDialog} />;
}

function Later({ controller, open, Screen }: { controller: GameController; open: boolean; Screen: typeof MenuDialog }) {
  const [wanted, setWanted] = useState(false);
  useEffect(() => {
    if (open) setWanted(true);
  }, [open]);
  useEffect(() => {
    const t = window.setTimeout(() => setWanted(true), 2000);
    return () => window.clearTimeout(t);
  }, []);
  if (!wanted) return null;
  return (
    <Suspense fallback={null}>
      <Screen controller={controller} />
    </Suspense>
  );
}

// Chopper's profile card (with its own little 3D canvas) loads the first time it's opened
const ChopperCard = lazy(() => import('./ChopperCard'));

function ChopperCardSlot({ controller }: { controller: GameController }) {
  const open = useStore(controller.store, (s) => s.chopperOpen);
  const [wanted, setWanted] = useState(false);
  useEffect(() => {
    if (open) setWanted(true);
  }, [open]);
  if (!wanted) return null;
  return (
    <Suspense fallback={null}>
      <ChopperCard controller={controller} />
    </Suspense>
  );
}

/**
 * What E does right now (collection-inventory.md §3.1): shake a tree, mine a boulder, pick a flower,
 * open the chest, sit on the bench or meet Chopper; while seated, stand up (the keys work too: E, Space).
 * On the pond bench E feeds the ducks instead (on the swing, a seat's own action: swing higher), and
 * standing up is the second button (Space).
 */
function ActionPrompt({ controller }: { controller: GameController }) {
  const seated = useStore(controller.store, (s) => s.seated);
  const canFeed = useStore(controller.store, (s) => s.canFeed);
  const target = useStore(controller.store, (s) => s.target);
  const lane = useStore(controller.store, focusLane);
  if (lane !== 'stand' && lane !== 'prompt') return null;
  const act = () => {
    if (seated) controller.standUp();
    else controller.useTarget();
    // back to the planet, so Space and WASD work straight away
    controller.focusRegion();
  };
  const feed = seated && canFeed;
  // seated, E can do something first: feed the ducks on the pond bench, or a chunk's seat's own action (the swing: swing higher)
  const extra = feed ? { label: 'Feed the ducks', icon: faBreadSlice, run: () => controller.feedDucks() } : seated ? controller.seatMotion.seat?.action : undefined;
  return (
    <div className="seat-prompt action-prompt lane" data-testid="seat-prompt" data-kind={feed ? 'feed' : extra ? 'seat-action' : seated ? 'stand' : target!.kind}>
      {extra && (
        <button className="btn primary" type="button" onClick={() => (extra.run(), controller.focusRegion())}>
          <Icon icon={extra.icon} /> {extra.label} <kbd>E</kbd>
        </button>
      )}
      <button className={extra ? 'btn' : 'btn primary'} type="button" onClick={act}>
        {seated ? (
          <>
            <Icon icon={faPersonWalking} /> Stand up <kbd>Space</kbd>
          </>
        ) : (
          <>
            <Icon icon={controller.targets.find((x) => x.key === target!.key)?.icon?.() ?? TARGET_ICONS[target!.kind as keyof typeof TARGET_ICONS]} /> {target!.label} <kbd>E</kbd>
          </>
        )}
      </button>
    </div>
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

/** Drag distance per planet hour (a whole day ≈ 480 px). */
export const TIME_PX_PER_HOUR = 20;
/** Movement (px) before a press on the badge becomes a drag rather than a click. */
const TIME_DRAG_THRESHOLD = 4;
const TIME_KEY_STEPS: Record<string, number> = { ArrowRight: 0.25, ArrowUp: 0.25, ArrowLeft: -0.25, ArrowDown: -0.25, PageUp: 1, PageDown: -1 };

/**
 * The planet clock, which is also a slider: drag it left/right to wind the time (the pointer hides
 * while dragging), click its left/right half to step an hour, or focus it and use the arrow keys
 * (15 min) and Page Up/Down (1 h). The day–night cycle carries on from the new time.
 */
function TimeBadge({ controller }: { controller: GameController }) {
  const [hours, setHours] = useState(controller.timeOfDay);
  const [scrubbing, setScrubbing] = useState(false);
  const drag = useRef<{ id: number; x: number; start: number; moved: boolean } | null>(null);
  useEffect(() => {
    const id = window.setInterval(() => !drag.current && setHours(controller.timeOfDay), 1000);
    return () => {
      window.clearInterval(id);
      controller.timeHeld = false;
      document.documentElement.classList.remove('time-scrubbing');
    };
  }, [controller]);

  const setTime = (h: number) => {
    controller.setTimeManually(h);
    setHours(controller.timeOfDay);
  };
  const stopScrub = () => {
    controller.timeHeld = false;
    document.documentElement.classList.remove('time-scrubbing');
    setScrubbing(false);
  };
  const done = () => {
    controller.announce(`Planet time set to ${formatHours(controller.timeOfDay)}.`);
    // pointer users go straight back to walking
    if (controller.store.getState().phase === 'playing') controller.focusRegion();
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, x: e.clientX, start: controller.timeOfDay, moved: false };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x;
    if (!d.moved) {
      if (Math.abs(dx) < TIME_DRAG_THRESHOLD) return;
      d.moved = true;
      controller.timeHeld = true;
      document.documentElement.classList.add('time-scrubbing');
      setScrubbing(true);
    }
    setTime(d.start + dx / TIME_PX_PER_HOUR);
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    if (d.moved) stopScrub();
    else {
      // a click steps an hour: the right half later, the left half earlier
      const r = e.currentTarget.getBoundingClientRect();
      setTime(controller.timeOfDay + (e.clientX >= r.left + r.width / 2 ? 1 : -1));
    }
    done();
  };
  const onPointerCancel = () => {
    if (!drag.current) return;
    const moved = drag.current.moved;
    drag.current = null;
    if (moved) {
      stopScrub();
      done();
    }
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = TIME_KEY_STEPS[e.key];
    if (step === undefined) return;
    e.preventDefault();
    setTime(controller.timeOfDay + step);
  };

  const h = wrapHours(hours);
  const night = h < SUNRISE || h >= SUNSET;
  const text = formatHours(h);
  return (
    <div
      className={`time-badge${scrubbing ? ' scrubbing' : ''}`}
      data-testid="time-badge"
      role="slider"
      tabIndex={0}
      aria-label="Planet time"
      aria-valuemin={0}
      aria-valuemax={1439}
      aria-valuenow={Math.floor(h * 60) % 1440}
      aria-valuetext={text}
      title={scrubbing ? undefined : 'Planet time — drag left or right to change it'}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onLostPointerCapture={onPointerCancel}
      onKeyDown={onKeyDown}
    >
      <Icon icon={night ? faMoon : faSun} className="time-icon" />
      {text}
    </div>
  );
}

/** Sound on/off: an icon toggle (its name stays "Sound", the pressed state carries on/off; crafting-screen.md §4.1). */
function SoundButton({ controller }: { controller: GameController }) {
  const on = useStore(controller.store, (s) => s.soundOn);
  return (
    <button
      type="button"
      className="btn icon-btn sound-btn"
      aria-label="Sound"
      aria-pressed={on}
      title={on ? 'Sound on — click to mute' : 'Sound off — click to unmute'}
      onClick={() => controller.setSound(!on)}
      data-testid="sound-button"
    >
      <Icon icon={on ? faVolumeHigh : faVolumeXmark} />
    </button>
  );
}

/**
 * Character picker (top right, under the header): two portrait buttons, one always selected
 * (thick ink border). A radio group: arrow keys move and select; clicking returns focus to the planet.
 */
function CharacterPicker({ controller }: { controller: GameController }) {
  const phase = useStore(controller.store, (s) => s.phase);
  const current = useStore(controller.store, (s) => s.character);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  if (phase === 'loading') return null;
  const choose = (id: CharacterId, byPointer: boolean) => {
    controller.setCharacter(id);
    if (byPointer && controller.store.getState().phase === 'playing') controller.focusRegion();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const j = (i + step + CHARACTERS.length) % CHARACTERS.length;
    choose(CHARACTERS[j].id, false);
    buttons.current[j]?.focus();
  };
  return (
    <div className="character-picker" role="radiogroup" aria-label="Choose your character" data-testid="character-picker">
      {CHARACTERS.map((c, i) => {
        const on = c.id === current;
        return (
          <button
            key={c.id}
            ref={(el) => {
              buttons.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={c.label}
            title={c.label}
            tabIndex={on ? 0 : -1}
            className={`avatar-btn${on ? ' selected' : ''}`}
            data-character={c.id}
            onClick={(e) => choose(c.id, e.detail > 0)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            <img src={c.portrait} alt="" width={64} height={64} draggable={false} />
          </button>
        );
      })}
    </div>
  );
}

function MenuButton({ controller, target }: { controller: GameController; target: HTMLElement | null }) {
  const phase = useStore(controller.store, (s) => s.phase);
  if (!target || phase === 'loading') return null;
  return createPortal(
    <>
      <TimeBadge controller={controller} />
      <SoundButton controller={controller} />
      {/* every place reachable without the canvas (spec §6): fast travel's tiles */}
      <button type="button" className="btn icon-btn" aria-label="Fast travel" title="Fast travel (T)" aria-haspopup="dialog" onClick={() => controller.openTravel()} data-testid="travel-button">
        <Icon icon={faLocationDot} />
      </button>
      <button type="button" className="btn icon-btn" aria-label="Menu" title="Menu (M)" aria-haspopup="dialog" onClick={() => controller.openMenu()} data-testid="menu-button">
        <Icon icon={faBars} />
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
  // the crafting screen, the palette and the site card come with the crafting chunk (crafting.md)
  const CraftScreens = controller.craft?.Screens ?? null;
  // talking with the family: the dialog box comes with the home chunk (family.md §6)
  const HomeHud = controller.home?.Hud ?? null;
  return (
    <>
      <PreviewCard controller={controller} />
      <ActionPrompt controller={controller} />
      {HomeHud && <HomeHud />}
      <Hotbar controller={controller} />
      <ViewControls controller={controller} />
      <CharacterPicker controller={controller} />
      <Toast controller={controller} />
      <LiveRegion controller={controller} />
      <div
        className="fade-overlay"
        aria-hidden="true"
        ref={(el) => {
          controller.fadeEl.current = el;
        }}
      />
      <LandmarkDialogSlot controller={controller} />
      <MenuDialogSlot controller={controller} />
      <InventoryScreen controller={controller} />
      <ChopperCardSlot controller={controller} />
      {CraftScreens && <CraftScreens />}
      <MenuButton controller={controller} target={controller.hudActions} />
      <ContextLost controller={controller} />
    </>
  );
}
