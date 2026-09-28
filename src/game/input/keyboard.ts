import type { MoveIntent } from '../types';

export type GameAction =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'run'
  | 'interact'
  | 'back'
  | 'menu'
  | 'rotateCcw'
  | 'rotateCw'
  | 'tiltUp'
  | 'tiltDown'
  | 'faceNorth'
  | 'home'
  | 'inventory'
  | 'drop'
  | 'whistle'
  | 'sit'
  | 'lie'
  | 'slot1'
  | 'slot2'
  | 'slot3'
  | 'slot4'
  | 'slot5'
  | 'slot6'
  | 'slot7'
  | 'slot8'
  | 'slot9';

/** Actions that are held (continuous) rather than triggered once. */
export const VIEW_HOLD_ACTIONS: ReadonlySet<GameAction> = new Set(['rotateCcw', 'rotateCw', 'tiltUp', 'tiltDown']);

/** Layout-independent key bindings (KeyboardEvent.code). */
export const KEY_BINDINGS: Record<string, GameAction> = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'run',
  ShiftRight: 'run',
  KeyE: 'interact',
  Enter: 'interact',
  NumpadEnter: 'interact',
  // Space goes back: stands up, gets off, ends a conversation, closes a screen (E and Enter do)
  Space: 'back',
  KeyM: 'menu',
  Escape: 'menu',
  // view: rotate with , and . (the < > keys), tilt with Page Up / Page Down
  Comma: 'rotateCcw',
  Period: 'rotateCw',
  PageUp: 'tiltUp',
  PageDown: 'tiltDown',
  KeyN: 'faceNorth',
  KeyH: 'home',
  Home: 'home',
  // inventory (Minecraft: 1–9 select a hotbar slot, Q drops; I opens the backpack since E interacts here)
  KeyI: 'inventory',
  KeyQ: 'drop',
  // whistle for Chopper
  KeyF: 'whistle',
  // rest anywhere: sit on the grass (X, as World of Warcraft's sit) or lie back on it (Z, as the prone key in shooters)
  KeyX: 'sit',
  KeyZ: 'lie',
  Digit1: 'slot1',
  Digit2: 'slot2',
  Digit3: 'slot3',
  Digit4: 'slot4',
  Digit5: 'slot5',
  Digit6: 'slot6',
  Digit7: 'slot7',
  Digit8: 'slot8',
  Digit9: 'slot9',
};

/**
 * Space in a screen or dialog: go back (close it), unless the focus is on a control whose own key it is
 * (a text field, a checkbox or a slider). Enter still activates the focused button.
 */
export const spaceBack = (e: { code: string; repeat: boolean; target: EventTarget | null }): boolean =>
  e.code === 'Space' && !e.repeat && !(e.target as Element | null)?.closest?.('input:not([type=button]),select,textarea,[role=slider],[role=checkbox],[role=switch],[role=radio]');

export class KeyboardInput {
  private readonly held = new Set<GameAction>();
  override: MoveIntent | null = null;

  /** Returns the bound action, or null for keys the game doesn't handle (e.g. Tab). */
  static actionFor(code: string): GameAction | null {
    return KEY_BINDINGS[code] ?? null;
  }

  down(action: GameAction): void {
    this.held.add(action);
  }

  up(action: GameAction): void {
    this.held.delete(action);
  }

  clear(): void {
    this.held.clear();
  }

  intent(): MoveIntent {
    if (this.override) return this.override;
    const x = (this.held.has('right') ? 1 : 0) - (this.held.has('left') ? 1 : 0);
    const y = (this.held.has('up') ? 1 : 0) - (this.held.has('down') ? 1 : 0);
    return { x, y, run: this.held.has('run') };
  }

  /** Held view input: rotation (+1 counter-clockwise) and tilt (+1 toward top view). */
  viewIntent(): { rotate: number; tilt: number } {
    return {
      rotate: (this.held.has('rotateCcw') ? 1 : 0) - (this.held.has('rotateCw') ? 1 : 0),
      tilt: (this.held.has('tiltUp') ? 1 : 0) - (this.held.has('tiltDown') ? 1 : 0),
    };
  }
}
