import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { CONFIG } from '../../src/game/config';
import { landmarkGeometry } from '../../src/game/math/landmarks';
import { UP, arcDistance, moveAlong, tangentToward, type Obstacle } from '../../src/game/math/sphere';
import { FLOWER_KINDS, canopyRadius, generateProps } from '../../src/game/world/layout';
import { Terrain } from '../../src/game/world/terrain';
import { mesaPolar, mesaRadius, tierEdge, tierPolar } from '../../src/game/world/features';
import { DECK, deckFootprint } from '../../src/game/world/deckSpec';
import { DECK_BUILD, deckCorridors, deckObstacles, deckPlan, deckSurface, inDeck, onDeck, onPiece } from '../../src/game/world/craft/deckPlan';
import { deckStageModel } from '../../src/game/world/craft/deckModels';
import { DECK_NEEDS, HOUSE_NEEDS, MAX_NEEDS, RECIPES } from '../../src/game/world/craft/recipes';
import { SphereNav } from '../../src/game/world/home/nav';
import { Family, type FamilyWorld } from '../../src/game/world/home/family';
import { PlanetSim } from '../../src/game/systems/movement';
import { FIXTURE_LANDMARKS } from './fixtures';

const R = CONFIG.planetRadius;
const geos = FIXTURE_LANDMARKS.map((l) => landmarkGeometry(l));
const layout = generateProps(geos);
const terrain = new Terrain(geos, layout);
const site = layout.deck!;
const m = site.mesa;
const ground = (n: Vector3) => terrain.height(n);
const plan = deckPlan(site, ground, R);
const d = (a: Vector3, b: Vector3) => arcDistance(a, b, R);
const baseEdge = (n: Vector3) => {
  const p = mesaPolar(m, n);
  return p.r - mesaRadius(m.radiusU, m.seed, p.angle);
};
const tierEdgeD = (n: Vector3) => {
  const p = tierPolar(m, n);
  return p.r - tierEdge(m.tier!, p.angle);
};
/** Everything that blocks at `stage`: the landmarks, the layout's obstacles with the deck cliff's swapped for the stage's. */
const plainOf = layout.obstacles.filter((o) => o.mesa && d(o.n, m.n) < m.radiusU + 0.6);
function obstaclesAt(stage: number): Obstacle[] {
  const rest = layout.obstacles.filter((o) => !plainOf.includes(o));
  return [...geos.map((g) => ({ n: g.n, radiusU: g.footprintU })), ...rest, ...deckObstacles(plan, stage, R, plainOf)];
}
/** The centreline from the steps' foot to the bench, sampled every `step` u. */
function route(stage = 3, step = 0.05): Vector3[] {
  const pts: Vector3[] = [];
  const legs: Array<[Vector3, Vector3]> = [];
  for (const p of plan.pieces) if (p.stage <= stage) legs.push([p.a, p.b]);
  if (stage >= 3) legs.push([plan.at(DECK.deck.entryX, DECK.deck.d / 2), plan.at(DECK.deck.entryX, 0.2)], [plan.at(DECK.deck.entryX, 0.2), plan.seats.stand]);
  for (const [a, b] of legs) {
    const n = Math.max(1, Math.ceil(d(a, b) / step));
    for (let i = 0; i < n; i++) pts.push(a.clone().lerp(b, i / n).normalize());
  }
  return pts;
}

describe('the viewing deck (viewing-deck.md)', () => {
  it('stands on the two-tier cliff near the home, looking toward it', () => {
    expect(m.tier).toBeTruthy();
    expect(d(m.n, layout.home!.centre)).toBeLessThan(18);
    const toHome = mesaPolar(m, layout.home!.centre).angle;
    const off = Math.abs(((toHome - DECK.face + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    expect(off).toBeLessThan((25 * Math.PI) / 180);
  });

  it('fits: the steps run outside the lower wall and on the terrace, the platform inside the upper rim', () => {
    // stage 1: the flights stand off the lower wall; its last landing reaches onto the terrace
    const [p0, ...rest] = plan.pieces.filter((p) => p.stage === 1);
    expect(baseEdge(p0.a)).toBeGreaterThan(1);
    for (const p of rest.slice(0, -1)) expect(baseEdge(p.b)).toBeGreaterThan(0.6);
    const top = site.lower[site.lower.length - 1];
    expect(baseEdge(top)).toBeLessThan(-0.6);
    expect(tierEdgeD(top)).toBeGreaterThan(0.6);
    // stage 2: along the upper wall, its outer rail clear of the lower rim, then in over the upper rim
    const up = plan.pieces.filter((p) => p.stage === 2 && p.kind !== 'path');
    for (const p of up.slice(0, -1)) {
      for (const t of [0, 0.5, 1]) {
        const c = p.a.clone().lerp(p.b, t).normalize();
        expect(tierEdgeD(c)).toBeGreaterThan(0.5);
        expect(-baseEdge(c)).toBeGreaterThan(DECK.width / 2 + DECK_BUILD.railR + DECK_BUILD.rimIn + DECK_BUILD.rimR);
      }
    }
    // the platform's corners and its steps' foot are on the upper tier's top
    for (const x of [-1, 1]) for (const z of [-1, 1]) expect(tierEdgeD(plan.at((x * DECK.deck.w) / 2, (z * DECK.deck.d) / 2))).toBeLessThan(-0.1);
    expect(tierEdgeD(site.entry)).toBeLessThan(-0.45);
    // and the path across the top to them passes beside the platform, not through it
    for (const across of plan.pieces.filter((p) => p.stage === 2 && p.kind === 'path').slice(1))
      for (let t = 0; t <= 1; t += 0.05) expect(inDeck(plan, across.a.clone().lerp(across.b, t).normalize(), R, 0.35)).toBe(false);
  });

  it('climbs steadily from the meadow to the platform, never into the ground, meeting it at both ends', () => {
    const chain = plan.pieces;
    for (const p of chain) {
      expect(p.hb).toBeGreaterThanOrEqual(p.ha - 1e-9);
      if (p.kind === 'wood' || p.kind === 'landing' || p.kind === 'top') {
        for (let t = 0.1; t <= 0.9; t += 0.2) {
          const c = p.a.clone().lerp(p.b, t).normalize();
          if (baseEdge(c) > 0.15 && (p.stage === 1 || tierEdgeD(c) > 0.15)) expect(p.ha + (p.hb - p.ha) * t).toBeGreaterThan(ground(c) + 0.03);
        }
      }
    }
    expect(chain[0].ha).toBeCloseTo(ground(site.lower[0]), 5);
    expect(plan.deckH).toBeGreaterThan(ground(plan.site.centre) + 0.3);
    // steps no steeper than about 30°
    for (const p of chain) if (p.kind === 'wood' || p.kind === 'stone') expect((p.hb - p.ha) / (d(p.a, p.b) || 1)).toBeLessThan(0.62);
  });

  it('you walk up it: the walk height follows the steps without a jump, from the meadow to the bench', () => {
    const t = new Terrain(geos, layout);
    t.addSurface(deckSurface(plan, 3, R));
    const pts = route(3, 0.03);
    let prev = t.walkHeight(pts[0]);
    expect(Math.abs(prev - ground(pts[0]))).toBeLessThan(0.05);
    let worst = 0;
    for (const p of pts) {
      const h = t.walkHeight(p);
      worst = Math.max(worst, Math.abs(h - prev));
      prev = h;
    }
    expect(worst).toBeLessThan(0.06);
    expect(t.walkHeight(plan.seats.stand)).toBeCloseTo(plan.deckH, 5);
    // unbuilt, there's nothing to stand on
    const bare = new Terrain(geos, layout);
    bare.addSurface(deckSurface(plan, 0, R));
    expect(bare.walkHeight(plan.pieces[3].a)).toBeCloseTo(ground(plan.pieces[3].a), 5);
  });

  it('keeps you on it: the way up is clear for the character, and rails close its sides', () => {
    const obs = obstaclesAt(3);
    const pr = CONFIG.playerRadius;
    for (const p of route(3, 0.08)) {
      const hit = obs.find((o) => d(p, o.n) < o.radiusU + pr - 0.02);
      expect(hit, `blocked at ${baseEdge(p).toFixed(2)} / ${tierEdgeD(p).toFixed(2)}`).toBeUndefined();
    }
    // a step off either side of any flight or landing runs into its rail
    const walk = deckSurface(plan, 3, R);
    for (const pc of plan.pieces.filter((p) => p.kind !== 'path' && p.kind !== 'stone')) {
      const lat = new Vector3().crossVectors(pc.a, new Vector3().subVectors(pc.b, pc.a)).normalize();
      for (const t of [0.3, 0.7]) {
        const c = pc.a.clone().lerp(pc.b, t).normalize();
        for (const s of [-1, 1]) {
          const out = moveAlong(c, lat, (s * (DECK.width / 2 + 0.45)) / R);
          // (beside a bend, a step off one piece lands on the next: that's walkway, not a drop)
          if (walk(out) > -Infinity) continue;
          const blocked = obs.some((o) => {
            // anywhere between the centre and a step out
            for (let k = 0; k <= 10; k++) if (d(c.clone().lerp(out, k / 10).normalize(), o.n) < o.radiusU + pr * 0.5) return true;
            return false;
          });
          expect(blocked, `${pc.kind} ${pc.stage} t${t} s${s}`).toBe(true);
        }
      }
    }
    // before anything's built the cliff is one block, as before
    expect(obstaclesAt(0).some((o) => o.mesa && d(o.n, m.n) < 0.01)).toBe(true);
  });

  it('the character walks up it for real (collisions and all): meadow, steps, terrace, steps, lawn, platform, bench', () => {
    const sim = new PlanetSim(obstaclesAt(3));
    const t = new Terrain(geos, layout);
    t.addSurface(deckSurface(plan, 3, R));
    const out = tangentToward(site.lower[0], m.n)!.negate();
    sim.placeAt(moveAlong(site.lower[0], out, 1.2 / R));
    // the corners of the way up, in order (each leg straight, as a click-to-walk goes)
    const legs = [...plan.pieces.map((p) => p.a), plan.pieces[plan.pieces.length - 1].b, plan.at(DECK.deck.entryX, 0.2), plan.seats.stand];
    let top = -Infinity;
    for (const goal of legs) {
      sim.startAutoWalk(goal);
      let arrived = false;
      for (let f = 0; f < 60 * 20 && !arrived; f++) {
        sim.step(1 / 60, { x: 0, y: 0, run: false });
        top = Math.max(top, t.walkHeight(sim.pLocal));
        for (const e of sim.drainEvents()) if (e.type === 'autowalk-arrived') arrived = true;
      }
      expect(arrived, `to ${baseEdge(goal).toFixed(2)} / ${tierEdgeD(goal).toFixed(2)}`).toBe(true);
    }
    expect(d(sim.pLocal, plan.seats.stand)).toBeLessThan(0.35);
    expect(t.walkHeight(sim.pLocal)).toBeCloseTo(plan.deckH, 5);
    expect(top).toBeCloseTo(plan.deckH, 5);
  });

  it('the family can route up it once built, and not before', () => {
    const wet = (n: Vector3) => terrain.inWater(n) && terrain.waterDepth(n) > 0.12;
    const from = moveAlong(site.lower[0], tangentToward(site.lower[0], m.n)!.negate(), 1.2 / R);
    const to = moveAlong(plan.seats.family.n, plan.seats.family.facing, 0.55 / R);
    const nav0 = new SphereNav(R, obstaclesAt(0), wet, 0.32);
    // (a route that can't get there goes as close as it can, then straight on: its last leg is blocked)
    const reaches = (nav: SphereNav, p: Vector3[] | null, goal: Vector3) => Boolean(p && p.length && nav.visible(p.length > 1 ? p[p.length - 2] : from, goal));
    expect(reaches(nav0, nav0.path(from, to), to)).toBe(false);
    for (const stage of [1, 2, 3]) {
      const nav = new SphereNav(R, obstaclesAt(0), wet, 0.32);
      nav.reblock(obstaclesAt(stage), deckCorridors(plan, stage));
      const goal = stage === 1 ? site.upper[1] : stage === 2 ? site.entry : to;
      expect(reaches(nav, nav.path(from, goal), goal), `stage ${stage}`).toBe(true);
      expect(reaches(nav0, nav0.path(from, goal), goal)).toBe(false);
    }
  });

  it('each build is its own model, with lanterns on the platform', () => {
    for (const k of [1, 2, 3] as const) {
      const g = deckStageModel(plan, k, ground, R);
      expect(g.solid).toBeTruthy();
      const tris = g.solid!.index!.count / 3;
      expect(tris).toBeGreaterThan(200);
      expect(tris).toBeLessThan(20000);
      if (k === 3) expect(g.glow).toBeTruthy();
    }
  });

  it('three builds, each at most four materials, with nails from iron ore (and Chopper’s house needs nails too)', () => {
    expect(DECK_NEEDS).toHaveLength(3);
    for (const n of DECK_NEEDS) {
      expect(n.length).toBeLessThanOrEqual(MAX_NEEDS);
      expect(n.some((x) => x.id === 'nails')).toBe(true);
    }
    const nails = RECIPES.find((r) => r.id === 'nails')!;
    expect(nails.needs[0].any).toEqual(['iron']);
    expect(nails.yield).toBeGreaterThan(1);
    expect(HOUSE_NEEDS.some((x) => x.id === 'nails')).toBe(true);
  });

  it('iron ore: one boulder in three carries it, some of them within a walk of the crafting table', () => {
    const iron = layout.boulders.filter((b) => b.iron);
    expect(iron.length).toBeGreaterThanOrEqual(5);
    expect(iron.filter((b) => d(b.n, layout.craft!.n) < 14).length).toBeGreaterThanOrEqual(1);
  });

  it('nothing stands on the steps or the platform, and the cliff keeps a tree on each level', () => {
    const zone = deckFootprint(site);
    const inZone = (n: Vector3, pad: number) => zone.some((z) => d(n, z.n) < z.r + pad);
    for (const t of [...layout.hardwood, ...layout.cedar, ...layout.fruit]) expect(inZone(t.n, canopyRadius(layout.cedar.includes(t)) * t.scale * 0.5)).toBe(false);
    for (const list of [layout.rocks, layout.boulders, layout.bushes, layout.pebbles, ...FLOWER_KINDS.map((k) => layout.flowers[k])]) for (const p of list) expect(inZone(p.n, 0)).toBe(false);
    // a tree frames the steps' foot; any left on the cliff block once you can get up there
    expect(layout.trees.some((t) => d(t.n, site.lower[0]) < 4 && baseEdge(t.n) > 1)).toBe(true);
    for (const t of [...layout.hardwood, ...layout.cedar].filter((t) => d(t.n, m.n) < m.radiusU)) expect(layout.obstacles.some((o) => o.n === t.n)).toBe(true);
    void UP;
  });

  it('the platform: its bench faces the view, with room in front to sit down and stand up', () => {
    const obs = obstaclesAt(3);
    for (const s of [plan.seats.visitor, plan.seats.family]) {
      const { z } = onDeck(plan, s.n, R);
      expect(z).toBeLessThan(0);
      expect(s.facing.dot(site.fwd)).toBeGreaterThan(0.95);
    }
    const stand = plan.seats.stand;
    expect(obs.find((o) => d(stand, o.n) < o.radiusU + CONFIG.playerRadius)).toBeUndefined();
    const t = onPiece(plan.pieces[plan.pieces.length - 1], site.entry, R);
    expect(t.t).toBeCloseTo(0, 5);
  });

  it('once built, Prabin walks up and sits on the bench now and then', () => {
    const obstacles = [...geos.map((g) => ({ n: g.n, radiusU: g.footprintU })), ...layout.obstacles.filter((o) => !plainOf.includes(o)), ...deckObstacles(plan, 3, R, plainOf)];
    const home = layout.home!;
    const pond = layout.pond!;
    const w: FamilyWorld = {
      hours: 12,
      others: [],
      pond: { n: pond.n, shore: (n) => terrain.pondShore(n) },
      R,
      home,
      player: new Vector3(0, 1, 0),
      obstacles,
      blocked: (n) => d(n, pond.n) < terrain.pondShore(n) + 0.05 || terrain.waterDepth(n) > 0.12,
      rabbits: [],
      flowers: [],
      planet: { spawn: UP.clone(), landmarks: geos.map((g) => ({ id: g.id, n: g.n, approach: g.approach, footprintU: g.footprintU })), craft: null, bridges: [] },
      deckSeat: plan.seats.family,
    };
    const f = new Family(home, R, () => 0.5, moveAlong(site.lower[0], tangentToward(site.lower[0], m.n)!.negate(), 1.5 / R));
    f.nav = Family.navFor(w);
    f.obstaclesChanged(w, deckCorridors(plan, 3));
    f.step(1 / 30, w);
    expect(f.hold('prabin', 'deck', w)).toBe(true);
    let sat = false;
    for (let t = 0; t < 90 && !sat; t += 1 / 30) {
      // (a meal comes first: ask again once it's over)
      if (f.get('prabin').activity !== 'deck' && !f.meal) f.hold('prabin', 'deck', w);
      f.step(1 / 30, w);
      sat = f.get('prabin').seat?.seat.id === 'deck' && f.get('prabin').seat?.phase === 'on';
    }
    expect(sat).toBe(true);
    expect(d(f.get('prabin').n, plan.seats.family.n)).toBeLessThan(0.05);
  });
});
