/**
 * Touch controls (documentation/game-ui/touch.md): the floating stick, the second-finger view drag, and
 * the input modality. Its own chunk, imported only on touch-capable devices; like the nature chunk it
 * takes nothing from the main bundle but types: everything comes through the controller.
 */
import type { GameController, TouchAttachment } from '../controller';
import { TouchGestures } from './gestures';
import { STICK } from './stick';
import { TOUCH_COPY, forTouch } from './touchCopy';

type Input = 'touch' | 'keys';

export function attachTouch(c: GameController): TouchAttachment {
  const g = new TouchGestures({ ...STICK });
  let ring: HTMLDivElement | null = null;
  let knob: HTMLDivElement | null = null;
  let origin = { x: 0, y: 0 };

  const setInput = (m: Input) => {
    if (c.store.getState().input === m) return;
    document.documentElement.dataset.input = m;
    c.store.setState({ input: m });
  };
  setInput(matchMedia('(pointer: coarse)').matches ? 'touch' : 'keys');
  document.documentElement.dataset.input = c.store.getState().input;
  document.addEventListener('pointerdown', (e) => setInput(e.pointerType === 'touch' ? 'touch' : 'keys'), { capture: true, passive: true });
  document.addEventListener('keydown', () => setInput('keys'), { capture: true, passive: true });

  /** The ring, made the first time it's needed, inside the planet region (under every HUD surface). */
  const view = (): HTMLDivElement | null => {
    if (!ring && c.region) {
      ring = document.createElement('div');
      ring.className = 'stick';
      ring.setAttribute('aria-hidden', 'true');
      ring.dataset.testid = 'stick';
      knob = document.createElement('div');
      knob.className = 'stick-knob';
      ring.append(knob);
      c.region.append(ring);
    }
    return ring;
  };

  const draw = () => {
    const el = view();
    if (!el || !knob) return;
    const s = g.stick;
    const r = el.offsetWidth / 2;
    el.style.transform = `translate(${s.ox - origin.x - r}px, ${s.oy - origin.y - r}px)`;
    const k = s.knob();
    knob.style.transform = `translate(${k.x}px, ${k.y}px)`;
    el.classList.toggle('run', s.run);
  };

  const release = () => {
    c.keyboard.override = null;
    ring?.classList.remove('on', 'run');
  };

  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    const step = g.move(e.pointerId, e.clientX, e.clientY);
    if (step?.start) {
      c.viewDragged = true;
      c.sim.cancelAutoWalk();
      // a fresh push stands you up, like a fresh key press
      if (c.seatMotion.seated) c.standUp();
      const el = view();
      if (el) {
        // the range is the drawn ring's radius, so the token (and Larger text) sizes it
        g.stick.cfg.range = el.offsetWidth / 2 || STICK.range;
        el.classList.add('on');
      }
    }
    if (step?.view) {
      c.viewDragged = true;
      c.sim.cancelAutoWalk();
      if (c.canUseView()) c.dragView(step.view.dx, step.view.dy);
    }
    if (g.holding && e.pointerId === g.stickId) {
      c.keyboard.override = g.stick.intent();
      draw();
    }
  };

  const onUp = (e: PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    if (g.up(e.pointerId)) release();
  };

  const onLost = () => {
    if (g.reset()) release();
  };

  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerup', onUp, { passive: true });
  // a system gesture (the home bar, a back swipe) ends a touch with pointercancel, never pointerup
  window.addEventListener('pointercancel', onUp, { passive: true });
  window.addEventListener('blur', onLost);
  document.addEventListener('visibilitychange', () => document.hidden && onLost());

  return {
    down(e) {
      if (e.pointerType !== 'touch' || !c.canUseView()) return false;
      if (g.idle && c.region) {
        const b = c.region.getBoundingClientRect();
        origin = { x: b.left, y: b.top };
      }
      g.down(e.pointerId, e.clientX, e.clientY);
      // a finger landing beside another is a view gesture, never a tap that walks
      if (!g.idle && g.stickId !== e.pointerId) c.viewDragged = true;
      return true;
    },
    copy: TOUCH_COPY,
    say: forTouch,
  };
}
