/**
 * The HUD's priority framework (docs: documentation/game-ui/design-system.md §6). Pure: the Hud
 * renders from these, and the controller routes E through `focusLane`, so what's on screen and what
 * E does can never disagree.
 */
import type { GameState } from '../state/store';

type LaneInput = Pick<GameState, 'phase' | 'traveling' | 'openId' | 'menuOpen' | 'invScreen' | 'craftScreen' | 'chopperOpen' | 'talk' | 'seated' | 'acting' | 'target' | 'nearbyId'>;

/** What owns the bottom-centre focus lane (and E): one surface at a time, or none. */
export type FocusLane = 'talk' | 'stand' | 'prompt' | 'preview' | null;

/** A modal dialog or a wood panel is open: it owns the keys, and the lanes stay empty. */
export function overlayOpen(s: Pick<GameState, 'openId' | 'menuOpen' | 'invScreen' | 'craftScreen' | 'chopperOpen'>): boolean {
  return Boolean(s.openId || s.menuOpen || s.invScreen || s.craftScreen || s.chopperOpen);
}

/**
 * The focus lane, highest priority first: a conversation, then standing up from a seat, then the
 * action prompt for the target, then the landmark preview. Nothing while travelling, before play,
 * under an overlay, or while an action is playing out.
 */
export function focusLane(s: LaneInput): FocusLane {
  if (s.phase !== 'playing' || s.traveling || overlayOpen(s)) return null;
  if (s.talk) return 'talk';
  if (s.seated) return 'stand';
  if (s.acting) return null;
  if (s.target) return 'prompt';
  if (s.nearbyId) return 'preview';
  return null;
}

/**
 * The focus lane as it would be with the overlays closed. The HUD keeps that surface mounted but
 * hidden under a modal, so the control that opened the modal is still there to take focus back.
 */
export function laneBeneath(s: LaneInput): FocusLane {
  return focusLane({ ...s, openId: null, menuOpen: false, invScreen: null, craftScreen: null, chopperOpen: false });
}

/** What owns the bottom-left aside: context before help, and nothing during a conversation. */
export type Aside = 'site' | 'hint' | null;

/** Below this width the aside and the focus lane share one bottom stack (hud.css), so the lane wins. */
export const COMPACT_QUERY = '(max-width: 760px)';

/** `compact`: a narrow screen, where the aside gives way whenever the focus lane has something. */
export function asideLane(s: LaneInput & Pick<GameState, 'siteNear' | 'hintVisible'>, compact = false): Aside {
  if (s.phase !== 'playing' || s.traveling || overlayOpen(s) || s.talk) return null;
  if (compact && focusLane(s)) return null;
  if (s.siteNear) return 'site';
  if (s.hintVisible) return 'hint';
  return null;
}

/** How long a toast stays (ms): long enough to read (WCAG 2.2.1), 4 to 9 s by length. */
export function toastMs(text: string): number {
  return Math.round(Math.min(9000, Math.max(4000, 2500 + 60 * text.length)));
}

/** The first E after a conversation opens is ignored for this long (a post-acceptance delay, GAG), so one press can't open and skip a line. */
export const TALK_GUARD_MS = 300;
