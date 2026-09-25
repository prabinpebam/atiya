import { createStore, type StoreApi } from 'zustand/vanilla';
import type { TimeMode } from '../world/timeOfDay';
import type { CharacterId } from '../player/characters';

export type Phase = 'loading' | 'ready' | 'playing';

export interface GameState {
  phase: Phase;
  nearbyId: string | null;
  /** The bench seat on offer (you're standing by it), or null. */
  seatNear: string | null;
  /** True while the character sits on a bench (from sitting down until it starts to stand up). */
  seated: boolean;
  openId: string | null;
  menuOpen: boolean;
  traveling: 'flyover' | 'fade' | null;
  reducedMotionSystem: boolean;
  reducedMotionUser: boolean;
  pauseAmbient: boolean;
  hintVisible: boolean;
  /** Text for the polite live region. */
  announcement: string;
  /** Short visible status message (also announced). */
  toast: string | null;
  contextLost: boolean;
  /** Current device-pixel-ratio cap (adaptive quality). */
  dpr: number;
  adaptiveQuality: boolean;
  /** Rendering tier: 'high' adds bloom/vignette and larger shadow maps; both tiers keep the tilt-shift. */
  quality: 'high' | 'low';
  /** Post-processing level on 'high': 2 = tilt-shift + bloom + vignette, 1 = tilt-shift only (adaptive fallback). */
  postLevel: 1 | 2;
  /** Day–night: 'cycle' (a full day ≈ 6 min), 'local' (visitor's clock) or 'day' (always daytime). */
  timeMode: TimeMode;
  /** Sound effects on (persisted; on by default, with a HUD toggle). */
  soundOn: boolean;
  /** Background music on (persisted; on by default; plays only with sound on). */
  musicOn: boolean;
  /** Which player character is chosen (persisted). */
  character: CharacterId;
}

export type GameStore = StoreApi<GameState>;

export function createGameStore(init: Partial<GameState> = {}): GameStore {
  return createStore<GameState>()(() => ({
    phase: 'loading',
    nearbyId: null,
    seatNear: null,
    seated: false,
    openId: null,
    menuOpen: false,
    traveling: null,
    reducedMotionSystem: false,
    reducedMotionUser: false,
    pauseAmbient: false,
    hintVisible: false,
    announcement: '',
    toast: null,
    contextLost: false,
    dpr: 1.5,
    adaptiveQuality: true,
    quality: 'high',
    postLevel: 2,
    timeMode: 'cycle',
    soundOn: true,
    musicOn: true,
    character: 'skater',
    ...init,
  }));
}

export const selectReducedMotion = (s: GameState) => s.reducedMotionSystem || s.reducedMotionUser;
export const selectAmbientPaused = (s: GameState) => selectReducedMotion(s) || s.pauseAmbient;
