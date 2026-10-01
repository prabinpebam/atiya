/**
 * Full planet (documentation/poc-3d-navigation/full-planet.md): the whole planet in view, to turn and look
 * at, with no character to move. Its own chunk, attached once the planet is complete (game-mount.tsx), so it
 * costs the planet's first load nothing: it imports nothing from the main bundle but types, and makes its
 * header button itself.
 *
 * The camera eases from the character's view straight back along its line of sight until the whole planet
 * fits; the world (the planet and the character, `controller.world`) turns as if grabbed, so the sun keeps
 * lighting the side in view; the tilt-shift's focus widens to the whole planet (it stays on); and the fog
 * follows the camera out (world/timeOfDay.ts `fogScale`, in the main bundle, as fast travel needs it too).
 * Fast travel, a building opening, Space, Escape or P end it, and the world turns back as the camera returns.
 */
import { Matrix4, Quaternion, Vector3, type Camera, type PerspectiveCamera } from 'three';
import type { GameController } from '../controller';
import type { GameAction } from '../input/keyboard';
import type { OverviewMode } from '../types';
import { OVERVIEW, ease, keyTurn, overviewDistance, stepWeight, turnWorld } from './overviewMath';

/**
 * Font Awesome Free's solid "earth-asia" (CC BY 4.0, assets-src/CREDITS.md), as its path: importing the
 * icon package from this chunk would re-split the main bundle's shared chunks (world/nature.ts).
 */
const EARTH = {
  name: 'earth-asia',
  size: 512,
  path: 'M50 284.8c4.2 2.1 9 3.2 14 3.2l50.7 0c8.5 0 16.6 3.4 22.6 9.4l13.3 13.3c6 6 14.1 9.4 22.6 9.4l18.7 0c17.7 0 32-14.3 32-32l0-40c0-13.3 10.7-24 24-24s24-10.7 24-24l0-42.7c0-8.5 3.4-16.6 9.4-22.6l13.3-13.3c6-6 9.4-14.1 9.4-22.6L304 57c0-1.2-.1-2.3-.2-3.5-15.4-3.6-31.4-5.5-47.8-5.5-114.9 0-208 93.1-208 208 0 9.8 .7 19.4 2 28.8zm403.3 37.3c-3.2-1.4-6.7-2.1-10.5-2.1L432 320c-8.8 0-16-7.2-16-16s-7.2-16-16-16l-34.7 0c-8.5 0-16.6 3.4-22.6 9.4l-45.3 45.3c-6 6-9.4 14.1-9.4 22.6l0 18.7c0 17.7 14.3 32 32 32l18.7 0c8.5 0 16.6 3.4 22.6 9.4 2.2 2.2 4.7 4.1 7.3 5.5 39.3-25.4 69.5-63.6 84.6-108.8zM0 256a256 256 0 1 1 512 0 256 256 0 1 1 -512 0zM128 368c0 8.8 7.2 16 16 16l32 0c8.8 0 16-7.2 16-16s-7.2-16-16-16l-32 0c-8.8 0-16 7.2-16 16zM272 256c-8.8 0-16 7.2-16 16l0 32c0 8.8 7.2 16 16 16s16-7.2 16-16l0-32c0-8.8-7.2-16-16-16zm48-112l0 32c0 8.8 7.2 16 16 16s16-7.2 16-16l0-32c0-8.8-7.2-16-16-16s-16 7.2-16 16z',
} as const;

const ORIGIN = new Vector3();
const UP = new Vector3(0, 1, 0);
const _pos = new Vector3();
const _rigPos = new Vector3();
const _rigQ = new Quaternion();
const _goalQ = new Quaternion();
const _m = new Matrix4();

/** The header's button: the earth, drawn as the game's other icons are (ui/Icon.tsx), its state in aria-pressed. */
function makeButton(): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn icon-btn';
  b.setAttribute('aria-label', 'View whole planet');
  b.setAttribute('aria-pressed', 'false');
  b.title = 'View whole planet (P)';
  b.dataset.testid = 'overview-button';
  b.innerHTML = `<svg class="icon" viewBox="0 0 ${EARTH.size} ${EARTH.size}" width="1em" height="1em" fill="currentColor" aria-hidden="true" focusable="false" data-icon="${EARTH.name}"><path d="${EARTH.path}"/></svg>`;
  return b;
}

export function attachOverview(controller: GameController): OverviewMode {
  let active = false;
  let w = 0;
  const held = new Set<GameAction>();
  /** Turns still to come from the menu's View buttons and N (eased in): across, down. */
  const pending = { across: 0, down: 0 };
  /** Where the world was when the mode ended: it turns back from there as the camera returns. */
  const leaveFrom = new Quaternion();
  let back = false;
  /** The camera's axes in full planet (world space). */
  const right = new Vector3(1, 0, 0);
  const up = new Vector3(0, 1, 0);
  const toViewer = new Vector3(0, 0, 1);
  /** The tilt-shift's own focus area, per effect (the composer is rebuilt when the quality changes). */
  const focus = new WeakMap<object, number>();
  const reduced = () => {
    const s = controller.store.getState();
    return s.reducedMotionSystem || s.reducedMotionUser;
  };

  const button = makeButton();
  const actions = document.getElementById('hud-actions');
  const menu = actions?.querySelector('[data-testid="menu-button"]');
  if (menu) menu.before(button);
  else actions?.append(button);

  const set = (on: boolean, say = true) => {
    if (on === active) return;
    const s = controller.store.getState();
    if (on && (s.phase !== 'playing' || s.openId || controller.sim.travel)) return;
    if (on && s.talk) controller.endTalk();
    active = on;
    held.clear();
    pending.across = pending.down = 0;
    if (!on) {
      leaveFrom.copy(controller.world?.quaternion ?? _goalQ.identity());
      back = false;
    }
    document.body.classList.toggle('overview', on);
    button.setAttribute('aria-pressed', String(on));
    controller.sim.cancelAutoWalk();
    controller.requestFrame?.();
    if (!say) return;
    const touch = s.input === 'touch';
    controller.announce(
      on
        ? touch
          ? 'Showing the whole planet. Drag to turn it, and tap the planet button to go back.'
          : 'Showing the whole planet. Drag or use the arrow keys to turn it; press P or Space to go back.'
        : 'Back to your character.',
    );
  };

  button.addEventListener('click', () => {
    set(!active);
    controller.focusRegion();
  });
  addEventListener('blur', () => held.clear());

  const mode: OverviewMode = {
    get on() {
      return active || w > 0;
    },

    key(action, down, code) {
      if (!down) {
        held.delete(action);
        return active;
      }
      if (action === 'overview') {
        set(!active);
        return true;
      }
      if (!active) return false;
      // Space and Escape go back (design system §6.7); the menu (M), fast travel and the plaza go on as usual
      if (action === 'back' || code === 'Escape') {
        set(false);
        return true;
      }
      if (action === 'menu' || action === 'travel' || action === 'home') return false;
      // N: back to the way the character sees it, still in full planet
      if (action === 'faceNorth') {
        const q = controller.world?.quaternion;
        if (q) {
          leaveFrom.copy(q);
          back = true;
        }
        return true;
      }
      if (keyTurn(action)) held.add(action);
      // everything else would move or use the character: there's none to move here
      return true;
    },

    drag(dx, dy) {
      if (!active) return false;
      const q = controller.world?.quaternion;
      if (q) {
        back = false;
        turnWorld(q, dx * OVERVIEW.dragPerPx, dy * OVERVIEW.dragPerPx, 0, right, up, toViewer);
      }
      return true;
    },

    nudge(turn, tilt) {
      if (!active) return false;
      back = false;
      pending.across += turn * OVERVIEW.stepRad;
      pending.down += tilt * OVERVIEW.stepRad;
      controller.requestFrame?.();
      return true;
    },

    frame(camera: Camera, dt) {
      const s = controller.store.getState();
      // fast travel or a building opening takes the view back to the character
      if (active && (controller.sim.travel || s.openId)) set(false, false);
      const instant = reduced();
      w = stepWeight(w, active, dt, instant);
      const world = controller.world;
      const tilt = controller.tiltShift;
      if (tilt && !focus.has(tilt)) focus.set(tilt, tilt.focusArea);
      if (w === 0) {
        if (world && !world.quaternion.equals(_goalQ.identity())) world.quaternion.identity();
        if (tilt) tilt.focusArea = focus.get(tilt)!;
        return;
      }
      const e = ease(w);
      // the whole planet: straight back along the character view's line of sight, looking at its centre
      _rigPos.copy(camera.position);
      _rigQ.copy(camera.quaternion);
      const cam = camera as PerspectiveCamera;
      _pos.copy(_rigPos).normalize().multiplyScalar(overviewDistance(cam.fov ?? 35, cam.aspect ?? 1));
      _goalQ.setFromRotationMatrix(_m.lookAt(_pos, ORIGIN, UP));
      right.set(1, 0, 0).applyQuaternion(_goalQ);
      up.set(0, 1, 0).applyQuaternion(_goalQ);
      toViewer.set(0, 0, 1).applyQuaternion(_goalQ);
      camera.position.lerpVectors(_rigPos, _pos, e);
      camera.quaternion.slerpQuaternions(_rigQ, _goalQ, e);
      if (tilt) tilt.focusArea = focus.get(tilt)! + (OVERVIEW.focusArea - focus.get(tilt)!) * e;
      if (!world) return;
      const q = world.quaternion;
      if (!active) {
        // turning back with the camera, from wherever it was left
        q.slerpQuaternions(_goalQ.identity(), leaveFrom, e);
        return;
      }
      if (back) {
        // N: eased back to the character's view
        const k = instant ? 1 : 1 - Math.exp(-6 * dt);
        q.slerp(_goalQ.identity(), k);
        if (q.angleTo(_goalQ) < 1e-3) {
          q.identity();
          back = false;
        }
      }
      let across = 0;
      let down = 0;
      let roll = 0;
      for (const a of held) {
        const t = keyTurn(a);
        if (t) {
          across += t.across;
          down += t.down;
          roll += t.roll;
        }
      }
      const rate = OVERVIEW.keyPerS * Math.min(Math.max(dt, 0), 0.1);
      if (across || down || roll) back = false;
      // the View buttons' steps, eased in
      const k = instant ? 1 : 1 - Math.exp(-10 * dt);
      const pa = Math.abs(pending.across) < 1e-3 ? pending.across : pending.across * k;
      const pd = Math.abs(pending.down) < 1e-3 ? pending.down : pending.down * k;
      pending.across -= pa;
      pending.down -= pd;
      turnWorld(q, across * rate + pa, down * rate + pd, roll * rate, right, up, toViewer);
      if (pending.across || pending.down) controller.requestFrame?.();
    },
  };
  controller.overview = mode;
  return mode;
}
