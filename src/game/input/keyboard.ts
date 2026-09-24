import type { MoveIntent } from '../types';

export type GameAction =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'run'
  | 'interact'
  | 'menu'
  | 'rotateCcw'
  | 'rotateCw'
  | 'tiltUp'
  | 'tiltDown'
  | 'faceNorth'
  | 'home';

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
  Space: 'interact',
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
};

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
