import { createStore, type StoreApi } from 'zustand/vanilla';
import type { TimeMode } from '../world/timeOfDay';
import type { CharacterId } from '../player/characters';

export type Phase = 'loading' | 'ready' | 'playing';

export interface GameState {
  phase: Phase;
  nearbyId: string | null;
  /** What E would use right now (a tree, boulder, flower, the chest, the bench, Chopper, the crafting table, his house's site…), with its prompt text. */
  target: { kind: 'tree' | 'boulder' | 'flower' | 'chest' | 'bench' | 'dog' | 'npc' | 'craft' | 'site'; key: string; label: string } | null;
  /** The action cycle playing (shake, mine, pick, open), or null. */
  acting: 'shake' | 'mine' | 'pick' | 'open' | null;
  /** The inventory screen that's open: the backpack on its own, or the chest with it. */
  invScreen: 'backpack' | 'chest' | null;
  /** The crafting screen (crafting.md §4.2), or the palette for Chopper's house (§4.3), when open. */
  craftScreen: 'table' | 'paint' | null;
  /** Bumped on every inventory change (the hotbar and screens re-render). */
  invVersion: number;
  /** True while the character sits on a bench (from sitting down until it starts to stand up). */
  seated: boolean;
  /** Seated on the pond bench: E feeds the ducks (and a second button offers it). */
  canFeed: boolean;
  /** True while Chopper's profile card is open. */
  chopperOpen: boolean;
  /** Talking with one of the family (family.md §6): who, the lines, which one is showing, and a counter that reveals the line at once. */
  talk: { id: string; name: string; lines: string[]; index: number; reveal: number } | null;
  openId: string | null;
  menuOpen: boolean;
  traveling: 'flyover' | 'fade' | null;
  reducedMotionSystem: boolean;
  reducedMotionUser: boolean;
  pauseAmbient: boolean;
  hintVisible: boolean;
  /** Close to Chopper's house site while it's unbuilt: the aside shows its card (set by the crafting chunk). */
  siteNear: boolean;
  /** Larger text (a menu setting, saved): every rem-based size scales up. */
  largeText: boolean;
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
    target: null,
    acting: null,
    invScreen: null,
    craftScreen: null,
    invVersion: 0,
    seated: false,
    canFeed: false,
    chopperOpen: false,
    talk: null,
    openId: null,
    menuOpen: false,
    traveling: null,
    reducedMotionSystem: false,
    reducedMotionUser: false,
    pauseAmbient: false,
    hintVisible: false,
    siteNear: false,
    largeText: false,
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
