import { describe, expect, it } from 'vitest';
import { DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { CONFIG } from '../../src/game/config';
import { landmarkGeometry } from '../../src/game/math/landmarks';
import { UP, arcDistance, moveAlong, tangentToward, type Obstacle } from '../../src/game/math/sphere';
import { FLOWER_KINDS, canopyRadius, generateProps } from '../../src/game/world/layout';
import { Terrain } from '../../src/game/world/terrain';
import { mesaPolar, mesaRadius, tierEdge, tierPolar } from '../../src/game/world/features';
import { DECK, deckFootprint } from '../../src/game/world/deckSpec';
import { DECK_BUILD, deckCorridors, deckObstacles, deckPlan, deckSurface, inDeck, onDeck, onPiece, runs } from '../../src/game/world/craft/deckPlan';
import { deckStageModel } from '../../src/game/world/craft/deckModels';
import { BONSAI, deckDressing } from '../../src/game/world/craft/deckDressing';
import { bonsaiModel, pineRoots } from '../../src/game/world/craft/bonsaiModel';
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
    // stage 1: the flights stand off the lower wall; its last landing ends flush with the rim (nothing of it on the terrace)
    const [p0, ...rest] = plan.pieces.filter((p) => p.stage === 1);
    expect(baseEdge(p0.a)).toBeGreaterThan(1);
    for (const p of rest.slice(0, -2)) expect(baseEdge(p.b)).toBeGreaterThan(0.6);
    // (the landing that cuts the last corner ends a little short of the rim)
    expect(baseEdge(rest[rest.length - 2].b)).toBeGreaterThan(0.2);
    const top = site.lower[site.lower.length - 1];
    expect(baseEdge(top)).toBeLessThan(0);
    expect(baseEdge(top)).toBeGreaterThan(-0.08);
    expect(tierEdgeD(top)).toBeGreaterThan(0.6);
    // stage 2: along the upper wall, its outer rail clear of the lower rim, then in over the upper rim
    const up = plan.pieces.filter((p) => p.stage === 2 && p.kind !== 'path');
    for (const p of up.slice(0, -2)) {
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

  it('turns only at obtuse corners: every bend of every run is wider than a right angle', () => {
    for (const run of runs(plan.pieces)) {
      for (let i = 1; i < run.length; i++) {
        const c = run[i].a;
        const back = tangentToward(c, run[i - 1].a)!;
        const on = tangentToward(c, run[i].b)!;
        const deg = (Math.acos(Math.max(-1, Math.min(1, back.dot(on)))) * 180) / Math.PI;
        expect(deg, `stage ${run[i].stage} bend ${i}`).toBeGreaterThan(115);
      }
    }
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
    // (off a landing onto the ground at its end is a small step: the landing lies just above the grass)
    expect(worst).toBeLessThan(0.08);
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

  it("the platform's boards cover its whole frame, flat at the deck's height (they're scaled up with it)", () => {
    const g = deckStageModel(plan, 3, ground, R);
    const mesh = new Mesh(g.solid!, new MeshBasicMaterial({ side: DoubleSide }));
    const rc = new Raycaster();
    const D = DECK.deck;
    const H = plan.deckH;
    let n = 0;
    let floor = 0;
    // (inside the railing, clear of the bench; a ray down finds a board's top within a hair of the walking height)
    for (let x = -D.w / 2 + 0.12; x <= D.w / 2 - 0.12; x += 0.07)
      for (let z = -D.d / 2 + 0.12; z <= D.d / 2 - 0.12; z += 0.07) {
        const p = plan.at(x, z).normalize();
        rc.set(p.clone().multiplyScalar(R + H + 2), p.clone().negate());
        const hits = rc.intersectObject(mesh).map((h) => h.point.length() - R);
        if (hits.some((h) => h > H + 0.05)) continue;
        n++;
        if (hits.some((h) => Math.abs(h - H) < 0.012)) floor++;
      }
    expect(n).toBeGreaterThan(300);
    // (the rest are the hairline gaps between boards)
    expect(floor / n).toBeGreaterThan(0.9);
  });

  it('three builds, each at most four materials, with nails from iron ingots, smelted from the ore (and Chopper’s house needs nails too)', () => {
    expect(DECK_NEEDS).toHaveLength(3);
    for (const n of DECK_NEEDS) {
      expect(n.length).toBeLessThanOrEqual(MAX_NEEDS);
      expect(n.some((x) => x.id === 'nails')).toBe(true);
    }
    const nails = RECIPES.find((r) => r.id === 'nails')!;
    // (furnace.md: the ore is smelted into ingots first)
    expect(nails.needs[0].any).toEqual(['ingot']);
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

  it('the cliff is planted (§4.6): bushes, flowers and sprigs on every level, off the way up, and an old pine over the upper rim', () => {
    const dr = deckDressing(layout, geos, R, ground, (n) => terrain.inWater(n))!;
    expect(dr).toBeTruthy();
    const all = [...dr.bushes, ...dr.flowerBushes, ...dr.sprigs, ...FLOWER_KINDS.flatMap((k) => dr.flowers[k])];
    const zone = deckFootprint(site);
    for (const p of all) {
      expect(zone.some((z) => d(p.n, z.n) < z.r)).toBe(false);
      expect(terrain.inWater(p.n)).toBe(false);
      expect(p.h).toBeCloseTo(ground(p.n), 6);
    }
    // round the foot, on the terrace and on the top
    const foot = all.filter((p) => baseEdge(p.n) > 0);
    const terrace = all.filter((p) => baseEdge(p.n) < 0 && tierEdgeD(p.n) > 0);
    const top = all.filter((p) => tierEdgeD(p.n) < 0);
    expect(foot.length).toBeGreaterThan(40);
    expect(terrace.length).toBeGreaterThan(8);
    // (the platform takes most of the top: what's left is a strip round its rim)
    expect(top.length).toBeGreaterThanOrEqual(4);
    expect(dr.bushes.length + dr.flowerBushes.length).toBeGreaterThanOrEqual(6);
    // the build site at the foot stays open, and the new solids never block the way up (built or not)
    for (const b of [...dr.bushes, ...dr.flowerBushes]) expect(d(b.n, site.lower[0])).toBeGreaterThan(2);
    const pr = CONFIG.playerRadius;
    for (const p of route(3, 0.08)) expect(dr.obstacles.find((o) => d(p, o.n) < o.radiusU + pr - 0.02)).toBeUndefined();
    // the pine stands on the top, just in from the rim, clear of the platform, and leans out past the rim
    const pine = dr.bonsai;
    expect(tierEdgeD(pine.n)).toBeLessThan(-0.15);
    expect(tierEdgeD(pine.n)).toBeGreaterThan(-0.6);
    expect(zone.some((z) => d(pine.n, z.n) < z.r + BONSAI.trunkR)).toBe(false);
    expect(tierEdgeD(moveAlong(pine.n, pine.out, 1.2 / R))).toBeGreaterThan(0);
    const g = bonsaiModel();
    g.solid.computeBoundingBox();
    // an old tree, twice the size of the first: it reaches well out over the rim and stands over 3 u tall, hung with creepers
    expect(g.solid.boundingBox!.max.x).toBeGreaterThan(3);
    expect(g.solid.boundingBox!.max.y).toBeGreaterThan(3);
    expect(g.ivy.getAttribute('position').count).toBeGreaterThan(400 * 4);
  });

  it('the old pine is rooted in the real cliff: its roots lie on the top, bend over the rim and cling down the wall', () => {
    const dr = deckDressing(layout, geos, R, ground, (n) => terrain.inWater(n))!;
    const { cliff } = dr.bonsai;
    // the frame agrees with the ground: the top is level with the trunk's foot, the terrace a tier below
    expect(Math.abs(cliff.ground(0, 0))).toBeLessThan(1e-6);
    const e = cliff.edge(0, 0);
    expect(Math.hypot(e.x, e.z)).toBeCloseTo(BONSAI.inset, 1);
    expect(cliff.inside(e.x - e.nx * 0.05, e.z - e.nz * 0.05)).toBe(true);
    expect(cliff.inside(e.x + e.nx * 0.05, e.z + e.nz * 0.05)).toBe(false);
    expect(cliff.ground(e.x + e.nx * 0.5, e.z + e.nz * 0.5)).toBeLessThan(-m.tier!.heightU * 0.8);
    const roots = pineRoots(cliff);
    let down = 0;
    for (const root of roots) {
      let onWall = 0;
      for (const [i, [x, y, z, r]] of root.entries()) {
        if (i <= 1) continue; // (from inside the trunk down to the ground)
        const [px, py, pz] = root[i - 1];
        expect(Math.hypot(x - px, y - py, z - pz)).toBeLessThan(0.3);
        const g = cliff.ground(x, z);
        const e = cliff.edge(x, z);
        const past = (x - e.x) * e.nx + (z - e.z) * e.nz;
        if (cliff.inside(x, z)) {
          // on the top: sunk in, never floating
          expect(y - g).toBeGreaterThan(-0.02);
          expect(y - g).toBeLessThan(r * 0.6 + 0.02);
        } else if (y > g + r * 0.6 + 0.02) {
          // on the face: just outside the wall (its ledges bulge up to 0.1 u), never out in the air
          expect(past).toBeGreaterThan(0);
          expect(past).toBeLessThan(0.2 + r);
          onWall++;
        } else expect(y - g).toBeGreaterThan(-0.02);
      }
      if (onWall >= 3) down++;
      // every root ends on the ground (the top or the terrace), not in the air
      const [x, y, z, r] = root[root.length - 1];
      expect(y - cliff.ground(x, z)).toBeLessThan(r + 0.15);
    }
    expect(down).toBeGreaterThanOrEqual(3);
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

  it('the visitor gets up the steps past Prabin standing on them: he makes way, or they squeeze past (collision.md §4)', () => {
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
      playerVel: new Vector3(),
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
    const flight = plan.pieces.filter((p) => p.stage === 1)[4];
    const on = flight.a.clone().lerp(flight.b, 0.5).normalize();
    const prabin = f.get('prabin');
    const sim = new PlanetSim([...obstaclesAt(3), { n: prabin.n, radiusU: 0.34, core: 0.16, soft: true }]);
    const t = new Terrain(geos, layout);
    t.addSurface(deckSurface(plan, 3, R));
    sim.placeAt(moveAlong(site.lower[0], tangentToward(site.lower[0], m.n)!.negate(), 0.8 / R));
    w.player.copy(sim.pLocal);
    // he stands in the middle of the long flight, facing down it (talking), and stays there
    f.greet('prabin', on, tangentToward(on, flight.a)!, w);
    const legs = [...plan.pieces.filter((p) => p.stage === 1).map((p) => p.b)];
    let time = 0;
    let moved = 0;
    for (const goal of legs) {
      sim.startAutoWalk(goal);
      let arrived = false;
      for (let k = 0; k < 60 * 12 && !arrived; k++) {
        sim.step(1 / 60, { x: 0, y: 0, run: false });
        w.player.copy(sim.pLocal);
        w.playerVel!.copy(sim.vel).applyQuaternion(sim.planetQ.clone().invert());
        f.step(1 / 60, w);
        time += 1 / 60;
        moved = Math.max(moved, d(prabin.n, on));
        for (const e of sim.drainEvents()) if (e.type === 'autowalk-arrived') arrived = true;
      }
      expect(arrived, `to ${baseEdge(goal).toFixed(2)}`).toBe(true);
    }
    expect(time).toBeLessThan(20);
    // (he was in the way: nudged aside or along as they came)
    expect(moved).toBeGreaterThan(0.2);
    // and he was never pushed off the steps into the cliff or through a rail
    expect(obstaclesAt(3).some((o) => d(prabin.n, o.n) < (o.core ?? o.radiusU) + 0.05)).toBe(false);
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
