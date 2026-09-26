import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { createGameStore, type GameState } from '../../src/game/state/store';
import { TALK_GUARD_MS, asideLane, focusLane, laneBeneath, overlayOpen, toastMs } from '../../src/game/ui/lanes';
import { TIER_U, pickTarget, type Target } from '../../src/game/systems/interactables';
import { moveAlong } from '../../src/game/math/sphere';
import { CONFIG } from '../../src/game/config';

const base = (): GameState => ({ ...createGameStore().getState(), phase: 'playing' });
const target = { kind: 'npc' as const, key: 'npc:prabin', label: 'Talk to Prabin' };
const talk = { id: 'prabin', name: 'Prabin', lines: ['Hi.'], index: 0, reveal: 0 };

describe('the focus lane: one surface at a time, and E does what it shows', () => {
  it('ranks a conversation over standing up, the prompt and the landmark preview', () => {
    const s = base();
    expect(focusLane(s)).toBeNull();
    expect(focusLane({ ...s, nearbyId: 'town-hall' })).toBe('preview');
    expect(focusLane({ ...s, nearbyId: 'town-hall', target })).toBe('prompt');
    expect(focusLane({ ...s, nearbyId: 'town-hall', target, seated: true })).toBe('stand');
    // the bug this fixes: talking by a landmark showed the preview card over the talk box
    expect(focusLane({ ...s, nearbyId: 'town-hall', talk })).toBe('talk');
    expect(focusLane({ ...s, nearbyId: 'town-hall', target, seated: true, talk })).toBe('talk');
  });

  it('is empty before play, while travelling, while an action plays out, and under any overlay', () => {
    const s = { ...base(), nearbyId: 'town-hall', target };
    expect(focusLane({ ...s, phase: 'ready' })).toBeNull();
    expect(focusLane({ ...s, traveling: 'flyover' })).toBeNull();
    expect(focusLane({ ...s, acting: 'shake' })).toBeNull();
    for (const o of [{ openId: 'town-hall' }, { menuOpen: true }, { invScreen: 'chest' as const }, { craftScreen: 'table' as const }, { chopperOpen: true }]) {
      expect(overlayOpen({ ...s, ...o })).toBe(true);
      expect(focusLane({ ...s, ...o })).toBeNull();
      expect(focusLane({ ...s, ...o, talk })).toBeNull();
    }
  });

  it('knows what lies beneath an overlay, so the control that opened it can take the focus back', () => {
    const s = { ...base(), nearbyId: 'workshop' };
    expect(laneBeneath({ ...s, openId: 'workshop' })).toBe('preview');
    expect(laneBeneath({ ...s, menuOpen: true, target })).toBe('prompt');
    expect(laneBeneath({ ...s, chopperOpen: true, talk })).toBe('talk');
    expect(laneBeneath({ ...s, openId: 'workshop', traveling: 'flyover' })).toBeNull();
    expect(laneBeneath(s)).toBe(focusLane(s));
  });
});

describe('the aside: context before help, nothing during a conversation', () => {
  it('shows the build-site card over the controls hint, and neither while talking or under an overlay', () => {
    const s = base();
    expect(asideLane(s)).toBeNull();
    expect(asideLane({ ...s, hintVisible: true })).toBe('hint');
    expect(asideLane({ ...s, hintVisible: true, siteNear: true })).toBe('site');
    expect(asideLane({ ...s, hintVisible: true, siteNear: true, talk })).toBeNull();
    expect(asideLane({ ...s, siteNear: true, menuOpen: true })).toBeNull();
    expect(asideLane({ ...s, siteNear: true, traveling: 'fade' })).toBeNull();
  });

  it('on a narrow screen (one bottom stack) gives way whenever the focus lane has something', () => {
    const s = { ...base(), hintVisible: true, siteNear: true };
    expect(asideLane(s, true)).toBe('site');
    expect(asideLane({ ...s, target }, true)).toBeNull();
    expect(asideLane({ ...s, nearbyId: 'town-hall' }, true)).toBeNull();
    // side by side on a wide screen, both show
    expect(asideLane({ ...s, target }, false)).toBe('site');
  });
});

describe('notices and the conversation guard', () => {
  it('keeps a toast up long enough to read: 4 s at least, longer for longer text, 9 s at most', () => {
    expect(toastMs('Saved.')).toBe(4000);
    const long = "Chopper's house still needs 2 stone slabs and 4 planks. Craft them at the crafting table by the Workshop.";
    expect(toastMs(long)).toBeGreaterThan(8000);
    expect(toastMs(long.repeat(3))).toBe(9000);
  });

  it('ignores the first E for a moment after a conversation opens (a post-acceptance delay)', () => {
    expect(TALK_GUARD_MS).toBeGreaterThanOrEqual(200);
    expect(TALK_GUARD_MS).toBeLessThanOrEqual(500);
  });
});

describe('target tiers: the one you came for wins', () => {
  const R = CONFIG.planetRadius;
  const p = new Vector3(0, 1, 0);
  const fwd = new Vector3(0, 0, 1);
  const at = (u: number, sideRad = 0) => moveAlong(p, fwd.clone().applyAxisAngle(p, sideRad), u / R);
  const t = (kind: Target['kind'], n: Vector3, reachU = 1.3): Target => ({ kind, key: `${kind}`, n, edgeU: 0, reachU, standU: 0.5, index: 0, scale: 1 });

  it('ranks people and purposeful things, then things to gather, then Chopper', () => {
    expect(TIER_U.npc).toBe(0);
    expect(TIER_U.chest).toBe(0);
    expect(TIER_U.tree).toBeGreaterThan(TIER_U.chest);
    expect(TIER_U.dog).toBeGreaterThan(TIER_U.flower);
  });

  it('talks to the person in front of you even when Chopper, at your heels, is closer', () => {
    const prabin = t('npc', at(0.8));
    const chopper = t('dog', at(0.4, 0.3), 1.2);
    expect(pickTarget(p, fwd, [prabin, chopper], null)?.kind).toBe('npc');
    // on his own, Chopper still gets the prompt
    expect(pickTarget(p, fwd, [chopper], null)?.kind).toBe('dog');
    // and when he's right in front and the person is well off to the side, he does too
    expect(pickTarget(p, fwd, [t('npc', at(1.2, 1.0)), t('dog', at(0.3), 1.2)], null)?.kind).toBe('dog');
  });
});
