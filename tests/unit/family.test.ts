import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { CONFIG } from '../../src/game/config';
import { landmarkGeometry } from '../../src/game/math/landmarks';
import { arcDistance } from '../../src/game/math/sphere';
import { FLOWER_KINDS, generateProps, mulberry32 } from '../../src/game/world/layout';
import { Terrain } from '../../src/game/world/terrain';
import { riverDistance } from '../../src/game/world/features';
import { HOME_R, TULSI_SPOT, YARD, fencePosts } from '../../src/game/world/homestead';
import { FAMILY, Family, LINES, LinePicker, ROUTINE, partOfDay, welcomeLines, type FamilyWorld, type SwingPlace } from '../../src/game/world/home/family';
import { Pendulum, PENDULUM } from '../../src/game/world/craft/swing';
import { SphereNav } from '../../src/game/world/home/nav';
import { UP, moveAlong, tangentToward } from '../../src/game/math/sphere';
import { FIXTURE_LANDMARKS } from './fixtures';
import { TOUCH_COPY } from '../../src/game/input/touchCopy';

const R = CONFIG.planetRadius;
const geos = FIXTURE_LANDMARKS.map((l) => landmarkGeometry(l));
const layout = generateProps(geos);
const terrain = new Terrain(geos, layout);
const home = layout.home!;
const obstacles = [...geos.map((g) => ({ n: g.n, radiusU: g.footprintU })), ...layout.obstacles];
const d = (a: Vector3, b: Vector3) => arcDistance(a, b, R);

function world(player = new Vector3(0, 1, 0), hours = 12): FamilyWorld {
  const pond = layout.pond!;
  return {
    hours,
    others: [],
    pond: { n: pond.n, shore: (n) => terrain.pondShore(n) },
    R,
    home,
    player,
    obstacles,
    blocked: (n) => d(n, pond.n) < terrain.pondShore(n) + 0.05 || terrain.waterDepth(n) > 0.12,
    rabbits: [],
    flowers: FLOWER_KINDS.flatMap((k) => layout.flowers[k].map((f) => f.n)).filter((n) => d(n, home.centre) < home.range),
    planet: {
      spawn: UP.clone(),
      landmarks: geos.map((g) => ({ id: g.id, n: g.n, approach: g.approach, footprintU: g.footprintU })),
      craft: layout.craft ? { n: layout.craft.n, facing: layout.craft.facing } : null,
      bridges: [],
    },
  };
}

/** The three who live at home all day (Prabin roams the planet). */
const HOME_IDS = ['rojina', 'laija', 'lingjel'];

const run = (f: Family, w: FamilyWorld, seconds: number, each?: () => void) => {
  for (let t = 0; t < seconds; t += 1 / 30) {
    f.step(1 / 30, w);
    each?.();
  }
};

describe('home by the pond: the site plan', () => {
  it('stands near the pond, on dry ground, clear of the river and of everything else', () => {
    expect(home).toBeTruthy();
    const own = new Set(home.obstacles);
    const others = layout.obstacles.filter((o) => !own.has(o) && o.n !== home.tree);
    const feats: Array<[string, Vector3, number]> = [
      ['house', home.house.n, HOME_R.house],
      ['chair', home.readingChair.n, HOME_R.chair],
      ['table', home.table.n, HOME_R.table],
      ['mat', home.mat.n, 0.75],
      ['fire', home.fire.n, HOME_R.fire],
      ['log', home.log.n, HOME_R.log],
      ...home.campChairs.map((c, i) => [`camp${i}`, c.n, HOME_R.chair] as [string, Vector3, number]),
      ...home.tableChairs.map((c, i) => [`tableChair${i}`, c.n, HOME_R.chair] as [string, Vector3, number]),
      ['tree', home.tree, HOME_R.tree],
    ];
    for (const [name, n, r] of feats) {
      for (const o of others) expect(d(n, o.n) - o.radiusU - r, `${name} vs obstacle`).toBeGreaterThan(0.05);
      const rd = riverDistance(layout.river!, n);
      expect(rd.d - layout.river!.halfWidth[rd.i] - r, `${name} vs river`).toBeGreaterThan(0.3);
      expect(terrain.inWater(n), `${name} in water`).toBe(false);
      expect(d(n, layout.pond!.n) - terrain.pondShore(n) - r, `${name} vs pond`).toBeGreaterThan(0.3);
      expect(d(n, layout.pond!.n), `${name} near the pond`).toBeLessThan(8);
    }
    // nicely spaced out: the big features are well apart
    const big = feats.filter(([n]) => ['house', 'table', 'mat', 'fire', 'tree'].includes(n));
    for (let i = 0; i < big.length; i++) for (let j = i + 1; j < big.length; j++) expect(d(big[i][1], big[j][1]), `${big[i][0]}–${big[j][0]}`).toBeGreaterThan(1.4);
    // nothing random left inside the cleared ground; the old oak joined the trees (not the hardwoods: it isn't shaken) and is the home's obstacle
    for (const list of [layout.hardwood, layout.bushes, layout.rocks, layout.boulders, layout.pebbles, layout.grass]) {
      for (const p of list) if (p.n !== home.tree) for (const c of home.clear) expect(d(p.n, c.n)).toBeGreaterThanOrEqual(c.r - 1e-9);
    }
    expect(layout.hardwood.some((t) => t.n === home.tree)).toBe(false);
    expect(layout.trees.some((t) => t.n === home.tree)).toBe(true);
    expect(home.obstacles.some((o) => o.n === home.tree && o.radiusU === HOME_R.tree)).toBe(true);
    // the shore spot is right by the water, but dry
    expect(d(home.shore.n, layout.pond!.n) - terrain.pondShore(home.shore.n)).toBeLessThan(1.2);
  });

  it("puts the ducks' nest on the quiet far bank: dry, a short waddle from the water, clear of everything", () => {
    const n = home.duckNest.n;
    const bank = d(n, layout.pond!.n) - terrain.pondShore(n);
    expect(terrain.inWater(n)).toBe(false);
    expect(bank).toBeGreaterThan(0.3);
    expect(bank).toBeLessThan(1.1);
    const rd = riverDistance(layout.river!, n);
    expect(rd.d - layout.river!.halfWidth[rd.i]).toBeGreaterThan(1);
    for (const o of layout.obstacles) if (o.n !== n) expect(d(n, o.n) - o.radiusU - HOME_R.nest, 'nest vs obstacle').toBeGreaterThan(0.3);
    // well away from where the family live and walk
    for (const s of [home.house.n, home.door.n, home.table.n, home.fire.n, home.mat.n, home.pondBench.n, home.shore.n, home.dogHouse.n, home.tree]) expect(d(n, s)).toBeGreaterThan(3);
    // it faces the water, and nothing grows in it
    expect(home.duckNest.facing.dot(tangentToward(n, layout.pond!.n)!)).toBeGreaterThan(0.99);
    for (const list of [layout.hardwood, layout.bushes, layout.rocks, layout.boulders, layout.pebbles, layout.grass, layout.sprigs]) for (const p of list) expect(d(p.n, n)).toBeGreaterThan(0.5);
  });
});

describe('home by the pond: the yard round the house', () => {
  const f = home.house.facing;
  const side = new Vector3().crossVectors(home.house.n, f).normalize();
  /** A point in the house's frame (u): `fwd` toward the pond, `side` to its left. */
  const rel = (n: Vector3) => {
    const h = home.house.n;
    const t = n.clone().addScaledVector(h, -n.dot(h)).normalize().multiplyScalar(h.angleTo(n) * R);
    return { fwd: t.dot(f), side: t.dot(side) };
  };
  const posts = fencePosts(home.yard.fence, YARD.postGap, R);
  const own = new Set(home.obstacles);
  const others = [...geos.map((g) => ({ n: g.n, radiusU: g.footprintU })), ...layout.obstacles.filter((o) => !own.has(o))];

  it('keeps the fence and the vegetable beds behind the house, on dry ground and clear of everything else', () => {
    const items: Array<[string, Vector3, number]> = [
      ...posts.map((n, i) => [`post${i}`, n, 0.06] as [string, Vector3, number]),
      ...home.yard.beds.map((b, i) => [`bed${i}`, b.n, YARD.bedL / 2] as [string, Vector3, number]),
      ['woodpile', home.yard.woodpile.n, 0.26],
    ];
    for (const [name, n, r] of items) {
      if (name !== 'woodpile') expect(rel(n).fwd, `${name} behind the house`).toBeLessThan(-(HOME_R.house + 0.5));
      expect(terrain.inWater(n), `${name} in water`).toBe(false);
      const rd = riverDistance(layout.river!, n);
      expect(rd.d - layout.river!.halfWidth[rd.i] - r, `${name} vs river`).toBeGreaterThan(0.3);
      for (const o of others) expect(d(n, o.n) - o.radiusU - r, `${name} vs obstacle`).toBeGreaterThan(0.05);
      // no tree stands in the yard or leans over it
      for (const t of layout.trees) if (t.n !== home.tree) expect(d(n, t.n) - r, `${name} vs tree`).toBeGreaterThan(0.9);
    }
    // the beds sit inside the fence's U, with room to walk round them
    const back = Math.min(...posts.map((n) => rel(n).fwd));
    for (const b of home.yard.beds) {
      const p = rel(b.n);
      expect(p.fwd - YARD.bedW / 2 - back).toBeGreaterThan(0.5);
      expect(2.3 - Math.abs(p.side) - YARD.bedL / 2).toBeGreaterThan(0.5);
    }
  });

  it('puts the tulsi on its own spot in front of the door, its niche toward the house, and no tree in front', () => {
    const t = rel(home.yard.tulsi.n);
    expect(Math.abs(t.fwd - TULSI_SPOT.fwd)).toBeLessThan(0.05);
    expect(Math.abs(t.side)).toBeLessThan(0.05);
    expect(d(home.yard.tulsi.n, home.door.n)).toBeGreaterThan(0.8);
    // its front (the diya's niche) faces the house
    expect(home.yard.tulsi.facing.dot(tangentToward(home.yard.tulsi.n, home.house.n)!)).toBeGreaterThan(0.99);
    for (const tr of layout.trees) {
      const p = rel(tr.n);
      expect(p.fwd > 0 && p.fwd < 5 && Math.abs(p.side) < 3, 'a tree in front of the house').toBe(false);
      // the tall cedar that stood beside it on the table's side is gone
      expect(Math.hypot(p.fwd + 1.8, p.side + 4.4)).toBeGreaterThan(1.1);
    }
  });

  it('can be walked into: a route from the door to the path between the beds', () => {
    const w = world();
    const nav = new SphereNav(R, obstacles, w.blocked, 0.28);
    const route = nav.path(home.door.n, home.yard.wateringCan.n);
    expect(route).toBeTruthy();
    expect(d(route![route!.length - 1], home.yard.wateringCan.n)).toBeLessThan(0.3);
  });
});

describe('the family: route planning', () => {
  it('plans a route round the house, through open ground only, and the route stays clear between waypoints', () => {
    const w = world();
    const nav = new SphereNav(R, obstacles, w.blocked, 0.28);
    // from behind the house to the picnic table's far side
    const behind = moveAlong(home.house.n, home.house.facing.clone().negate(), 1.9 / R);
    const past = moveAlong(home.table.n, home.table.facing, 1.2 / R);
    const route = nav.path(behind, past)!;
    expect(route).toBeTruthy();
    expect(d(route[route.length - 1], past)).toBeLessThan(0.3);
    const pts = [behind, ...route];
    let len = 0;
    for (let i = 1; i < pts.length; i++) {
      len += d(pts[i - 1], pts[i]);
      for (let t = 0; t <= 1; t += 0.05) {
        const p = pts[i - 1].clone().lerp(pts[i], t).normalize();
        for (const o of obstacles) expect(d(p, o.n), 'route crosses an obstacle').toBeGreaterThan(o.radiusU + 0.1);
        expect(w.blocked(p), 'route goes into the pond').toBe(false);
      }
    }
    // a sensible detour, not a wander
    expect(len).toBeLessThan(d(behind, past) * 2);
  });
});

describe('the family: behaviour', () => {
  it('each keeps to the home, out of the pond, and does a variety of things without repeating one straight away', () => {
    const w = world();
    const f = new Family(home, R, mulberry32(3));
    const seen: Record<string, Set<string>> = { rojina: new Set(), laija: new Set(), lingjel: new Set() };
    const seq: Record<string, string[]> = { rojina: [], laija: [], lingjel: [] };
    let bubbles = 0;
    let chased = false;
    const stuck: Record<string, number> = { rojina: 0, laija: 0, lingjel: 0 };
    let longest = 0;
    run(f, w, 420, () => {
      for (const n of f.npcs) {
        if (!HOME_IDS.includes(n.id)) continue;
        // never stuck: wanting to walk but not moving, for more than a couple of seconds
        stuck[n.id] = n.want > 0.3 && n.speed < 0.05 ? stuck[n.id] + 1 / 30 : 0;
        longest = Math.max(longest, stuck[n.id]);
        expect(d(n.n, home.centre), n.id).toBeLessThan(home.range + 1.5);
        expect(w.blocked(n.n), `${n.id} in the pond`).toBe(false);
        seen[n.id].add(n.activity);
        const s = seq[n.id];
        if (s[s.length - 1] !== n.activity) s.push(n.activity);
        if (n.bubble) bubbles++;
        if (n.activity === 'chase') chased = true;
      }
    });
    for (const id of ['rojina', 'laija', 'lingjel']) {
      expect(seen[id].size, `${id}: ${[...seen[id]].join(', ')}`).toBeGreaterThanOrEqual(3);
      // (being called over to talk interrupts: picking the same thing up again afterwards is fine)
      const acts = seq[id].filter((a) => a !== 'idle');
      for (let i = 1; i < acts.length; i++) expect(acts[i], `${id} repeated ${acts[i]}`).not.toBe(acts[i - 1]);
    }
    expect(seen.lingjel.has('cars') || seen.lingjel.has('lego')).toBe(true);
    expect(chased).toBe(true);
    // somebody talked to somebody (a bubble over whoever was speaking)
    expect(bubbles).toBeGreaterThan(0);
    expect(longest).toBeLessThan(2);
  });

  it('Rojina lays the table; Laija throws pebbles that land in the pond', () => {
    const w = world();
    const f = new Family(home, R, mulberry32(9));
    f.hold('rojina', 'serve', w);
    let served = false;
    run(f, w, 40, () => (served ||= f.foodOnTable));
    expect(served).toBe(true);
    f.hold('laija', 'throw', w);
    const splashes: Vector3[] = [];
    run(f, w, 30, () => {
      for (const e of f.events.splice(0)) if (e.type === 'splash') splashes.push(e.n);
    });
    expect(splashes.length).toBeGreaterThanOrEqual(3);
    for (const s of splashes) expect(w.blocked(s)).toBe(true);
  });

  it('stops and turns to the character to talk, then carries on', () => {
    const player = new Vector3();
    const w = world(player);
    const f = new Family(home, R, mulberry32(5));
    run(f, w, 10);
    const kid = f.get('lingjel');
    player.copy(kid.n).addScaledVector(kid.dir, -0.9 / R).normalize();
    f.startChat('lingjel');
    run(f, w, 2);
    expect(kid.chatting).toBe(true);
    expect(kid.speed).toBeLessThan(0.05);
    expect(kid.look).toBe(player);
    f.endChat('lingjel');
    const at = kid.n.clone();
    run(f, w, 30);
    expect(kid.chatting).toBe(false);
    expect(d(kid.n, at) > 0.1 || kid.activity !== 'idle').toBe(true);
  });

  it('someone on the move notices the character facing them: stops and looks for a few seconds, then carries on', () => {
    const player = new Vector3();
    const w = world(player);
    const f = new Family(home, R, mulberry32(5));
    // find a moment when Rojina is walking somewhere (and free to stop)
    const rojina = f.get('rojina');
    let t = 0;
    while (t < 600 && !(rojina.speed > 0.5 && f.canNotice(rojina))) {
      f.step(1 / 30, w);
      t += 1 / 30;
    }
    expect(rojina.speed).toBeGreaterThan(0.5);
    player.copy(rojina.n).addScaledVector(rojina.dir, 1.0 / R).normalize();
    const each = () => f.notice('rojina');
    run(f, w, 1, each);
    expect(f.attending('rojina')).toBe(true);
    expect(rojina.speed).toBeLessThan(0.1);
    expect(rojina.look).toBe(player);
    expect(rojina.dir.dot(tangentToward(rojina.n, player)!)).toBeGreaterThan(0.9);
    // past the notice time she goes back to what she was doing, even while still faced
    run(f, w, FAMILY.noticeS, each);
    expect(f.attending('rojina')).toBe(false);
    // facing her again straight after doesn't stop her again; after walking off a while, it does
    f.notice(null);
    run(f, w, 1);
    f.notice('rojina');
    expect(f.attending('rojina')).toBe(false);
    f.notice(null);
    run(f, w, 4);
    f.notice('rojina');
    expect(f.attending('rojina') || !f.canNotice(rojina)).toBe(true);
  });

  it('nobody busy stops for the character: carrying the picnic, the routine, a chat with one of the family', () => {
    const w = world(new Vector3(0, 1, 0));
    const f = new Family(home, R, mulberry32(5));
    const rojina = f.get('rojina');
    rojina.activity = 'serve';
    f.notice('rojina');
    expect(f.canNotice(rojina)).toBe(false);
    expect(f.attending('rojina')).toBe(false);
    rojina.activity = 'idle';
    rojina.partner = 'laija';
    expect(f.attending('rojina')).toBe(false);
    rojina.partner = null;
    expect(f.attending('rojina')).toBe(true);
    run(f, w, 0.1);
  });
});

describe('the welcome: Prabin meets the visitor as the game starts', () => {
  const player = new Vector3(0, 1, 0);
  const fwd = new Vector3(0, 0, -1);
  const at = moveAlong(player, fwd, 1.25 / R);
  const face = tangentToward(at, player)!;

  it('he stands in front of them, facing them, talking; after, he goes on with his day (home to bed at night)', () => {
    for (const hours of [12, 22]) {
      const w = world(player, hours);
      const f = new Family(home, R, mulberry32(3));
      run(f, w, 2);
      const prabin = f.get('prabin');
      f.greet('prabin', at, face, w);
      run(f, w, 3);
      expect(d(prabin.n, at), `${hours}h`).toBeLessThan(0.05);
      expect(prabin.chatting).toBe(true);
      expect(prabin.indoors).toBe(false);
      expect(prabin.dir.dot(tangentToward(prabin.n, player)!)).toBeGreaterThan(0.9);
      f.endChat('prabin');
      // still facing him after, he doesn't stop to look again: he goes on
      f.notice('prabin');
      expect(f.attending('prabin')).toBe(false);
      run(f, w, 20, () => f.notice('prabin'));
      expect(prabin.chatting).toBe(false);
      if (hours === 22) expect(prabin.activity === 'bedtime' || prabin.indoors).toBe(true);
      else expect(d(prabin.n, at) > 0.3 || prabin.activity !== 'idle').toBe(true);
    }
  });

  it('says hello, how to get about (keys or touch) and where the controls are; a returning visitor gets the short version', () => {
    const keys = welcomeLines(null, false);
    const touch = welcomeLines(TOUCH_COPY.hint, false);
    const back = welcomeLines(null, true);
    expect(keys[0]).toMatch(/Welcome to my little planet/);
    expect(keys.join(' ')).toMatch(/W A S D/);
    expect(keys.join(' ')).toMatch(/Press E/);
    expect(touch.join(' ')).not.toMatch(/\b(press|W A S D|Shift)\b/i);
    expect(touch.join(' ')).toMatch(/Drag anywhere to walk/);
    for (const lines of [keys, touch]) expect(lines.join(' ')).toMatch(/lantern/);
    for (const lines of [keys, touch, back]) expect(lines.at(-1)).toMatch(/notice board by the path to the Lighthouse/);
    expect(back.length).toBeLessThan(keys.length);
  });
});

describe('the family: routine, meals and room to move', () => {
  it('go in at 8 pm and come out at 6 am, but only a while after the clock is set by hand', () => {
    const w = world(new Vector3(0, 1, 0), 15);
    const f = new Family(home, R, mulberry32(4));
    run(f, w, 20);
    expect(f.npcs.every((n) => !n.indoors)).toBe(true);
    // the clock is wound to 9 pm: nothing happens straight away…
    w.hours = 21;
    run(f, w, ROUTINE.delay - 1);
    expect(f.schedule).toBe('day');
    expect(f.npcs.some((n) => n.activity === 'bedtime')).toBe(false);
    // …then they head for the door, and in
    run(f, w, 45);
    expect(f.schedule).toBe('night');
    for (const n of f.npcs) {
      expect(n.indoors, n.id).toBe(true);
      // through the door, and a little way into the room
      expect(d(n.n, f.insideSpot(R))).toBeLessThan(0.2);
    }
    // they stay in all night
    run(f, w, 30);
    expect(f.npcs.every((n) => n.indoors)).toBe(true);
    // morning, reached naturally (no jump): out they come at once, onto the lawn
    for (let h = 21; h < 30.2; h += 0.01) {
      w.hours = h % 24;
      f.step(1 / 30, w);
    }
    run(f, w, 15);
    expect(f.schedule).toBe('day');
    for (const n of f.npcs) expect(n.indoors, n.id).toBe(false);
    // at night on arrival (loading the page after dark), they're already inside
    const g = new Family(home, R, mulberry32(5));
    run(g, world(new Vector3(0, 1, 0), 23), 1);
    expect(g.npcs.every((n) => n.indoors)).toBe(true);
  });

  it('when lunch is on the table everyone comes to eat, then Rojina clears it away', () => {
    const w = world();
    const f = new Family(home, R, mulberry32(9));
    f.hold('rojina', 'serve', w);
    let allSeated = false;
    let served = false;
    let cleared = false;
    run(f, w, 150, () => {
      if (f.foodOnTable) served = true;
      if (f.npcs.every((n) => n.pose === 'eat' && n.seat?.phase === 'on')) {
        allSeated = true;
        // each on their own chair round the table (four: Prabin's too)
        for (const n of f.npcs) expect(Math.min(...home.tableChairs.map((c) => d(n.n, c.n)))).toBeLessThan(0.02);
        expect(new Set(f.npcs.map((n) => n.seat!.seat.id)).size).toBe(4);
      }
      if (served && !f.foodOnTable && !f.meal) cleared = true;
    });
    expect(served).toBe(true);
    expect(allSeated).toBe(true);
    expect(cleared).toBe(true);
    // and nobody's still sitting at the empty table
    expect(f.npcs.some((n) => n.activity === 'eat')).toBe(false);
  });

  it('nobody walks through anybody: the family keep clear of each other, the character and Chopper', () => {
    // the character standing in the middle of the home ground (where it can stand: clear of the furniture)
    let player = moveAlong(home.centre, home.house.facing, 0.6 / R);
    for (let k = 0; k < 40 && obstacles.some((o) => d(o.n, player) < o.radiusU + 0.4); k++) player = moveAlong(home.centre, home.house.facing.clone().applyAxisAngle(home.centre, k * 0.5), (0.6 + k * 0.05) / R);
    const dog = moveAlong(home.mat.n, home.mat.facing, 0.9 / R);
    const w = world(player);
    (w as unknown as { others: Vector3[] }).others = [dog];
    const f = new Family(home, R, mulberry32(11));
    let worstP = Infinity;
    let worstD = Infinity;
    let worstF = Infinity;
    run(f, w, 240, () => {
      for (const n of f.npcs) {
        if (n.indoors) continue;
        worstP = Math.min(worstP, d(n.n, player));
        worstD = Math.min(worstD, d(n.n, dog));
        for (const o of f.npcs) if (o !== n && !o.indoors) worstF = Math.min(worstF, d(n.n, o.n));
      }
    });
    expect(worstP).toBeGreaterThan(FAMILY.gapPlayer - 0.02);
    expect(worstD).toBeGreaterThan(FAMILY.gapOther - 0.02);
    expect(worstF).toBeGreaterThan(FAMILY.gapFamily - 0.02);
  });

  it('Laija throws her pebbles from different spots along the shore', () => {
    const w = world();
    const f = new Family(home, R, mulberry32(13));
    const spots: Vector3[] = [];
    for (let i = 0; i < 8; i++) {
      const s = f.shoreSpot(w)!;
      expect(s).toBeTruthy();
      expect(w.blocked(s.n)).toBe(false);
      // right by the water
      expect(d(s.n, layout.pond!.n) - terrain.pondShore(s.n)).toBeLessThan(0.8);
      spots.push(s.n);
    }
    const spread = Math.max(...spots.map((a) => Math.max(...spots.map((b) => d(a, b)))));
    expect(spread).toBeGreaterThan(1);
  });
});

describe('the family: dialog', () => {
  it('never repeats a line until the list is used up, and greets for the time of day', () => {
    const p = new LinePicker(mulberry32(1));
    const pool = LINES.laija.pool;
    const got = Array.from({ length: pool.length }, () => p.pick('k', pool));
    expect(new Set(got).size).toBe(pool.length);
    // the next round never starts with the line that just ended the last
    expect(p.pick('k', pool)).not.toBe(got[got.length - 1]);
    for (const [h, part] of [
      [8, 'morning'],
      [14, 'day'],
      [18.5, 'evening'],
      [23, 'night'],
      [2, 'night'],
    ] as const) {
      expect(partOfDay(h)).toBe(part);
      const c = p.conversation('rojina', 'read', h);
      expect(c.length).toBeGreaterThanOrEqual(2);
      expect(c.length).toBeLessThanOrEqual(3);
      expect(LINES.rojina.greet[part]).toContain(c[0]);
      expect(LINES.rojina.pool).toContain(c[c.length - 1]);
    }
  });
});

describe('the swing (swing.md §6)', () => {
  /** The swing as the crafting chunk shares it, on a real pendulum the test steps (as the chunk does). */
  const place = (built = true) => {
    const p = new Pendulum(1.2);
    const sw: SwingPlace & { p: Pendulum } = {
      p,
      seat: home.swing,
      built: () => built,
      rider: null,
      boarding: false,
      get a() {
        return p.a;
      },
      get w() {
        return p.w;
      },
      pivot: 1.62,
      pump: (k = 1) => p.pump(k),
    };
    return sw;
  };
  const tick = (sw: ReturnType<typeof place>) => () => {
    if (sw.boarding) sw.p.brake(1 / 30);
    sw.p.step(1 / 30);
  };

  it('a child walks over, gets on from an entry point, pumps it high, then lets it die down and gets off', () => {
    const f = new Family(home, R, mulberry32(5));
    const sw = place();
    const w = { ...world(), swing: sw };
    const kid = f.get('laija');
    const seat = f.seats.find((s) => s.id === 'swing')!;
    expect(f.swingFree(kid, w)).toBe(true);
    f.hold('laija', 'swing', w);
    let peak = 0;
    let boarded = false;
    run(f, w, 45, () => {
      tick(sw)();
      if (kid.seat?.phase === 'in' && !boarded) {
        boarded = true;
        // from an entry point, outside the swing's seat
        expect(d(kid.n, seat.spot.n)).toBeGreaterThan(0.6);
      }
      if (kid.seat?.phase === 'on') peak = Math.max(peak, Math.abs(sw.a));
    });
    expect(kid.seat?.seat.id).toBe('swing');
    expect(kid.seat?.phase).toBe('on');
    expect(kid.pose).toBe('swing');
    expect(sw.rider).toBe('laija');
    expect(d(kid.n, home.swing.n)).toBeLessThan(1e-6);
    // pumping swings it high, but never past its limit
    expect(peak).toBeGreaterThan(0.45);
    expect(peak).toBeLessThanOrEqual(PENDULUM.max + 1e-9);
    // nobody else can have it now
    expect(f.swingFree(f.get('lingjel'), w)).toBe(false);
    // time's up: no more pumping; once it's low she gets off, out onto an entry point, and it's free again
    kid.dur = kid.t;
    let off: Vector3 | null = null;
    run(f, w, 25, () => {
      tick(sw)();
      if (!off && kid.seat?.seat.id !== 'swing') off = kid.n.clone();
    });
    expect(off).not.toBeNull();
    expect(d(off!, home.swing.n)).toBeGreaterThan(0.6);
    expect(sw.rider).toBeNull();
    expect(seat.user).toBeNull();
    expect(f.swingFree(f.get('lingjel'), w)).toBe(true);
  });

  it('while the visitor is on it (or it is not built yet), nobody else gets on', () => {
    const f = new Family(home, R, mulberry32(6));
    const sw = place();
    sw.rider = 'visitor';
    const w = { ...world(), swing: sw };
    const kid = f.get('lingjel');
    expect(f.swingFree(kid, w)).toBe(false);
    f.hold('lingjel', 'swing', w);
    run(f, w, 3, tick(sw));
    expect(kid.seat).toBeNull();
    expect(kid.activity).not.toBe('swing');
    expect(sw.rider).toBe('visitor');
    const none = place(false);
    expect(f.swingFree(kid, { ...world(), swing: none })).toBe(false);
  });
});
