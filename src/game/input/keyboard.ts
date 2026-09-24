import type { MoveIntent } from '../types';

export type GameAction = 'up' | 'down' | 'left' | 'right' | 'run' | 'interact' | 'menu';

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
}
