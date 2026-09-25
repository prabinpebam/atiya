import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { DROP, Drops, type DropEnv } from '../../src/game/world/dropSim';
import { Inventory } from '../../src/game/inventory/inventory';
import type { ItemId } from '../../src/game/inventory/items';

const R = 10;
/** A point on the planet `u` from the pole along +x, `h` above the base sphere. */
const at = (u: number, h = 0) => new Vector3(Math.sin(u / R), Math.cos(u / R), 0).multiplyScalar(R + h);

function env(inv: Inventory, player: Vector3 | null, ground = 0): DropEnv {
  return {
    R,
    ground: () => ground,
    player,
    room: (item: ItemId, n: number) => inv.room(item, n),
    collect: (item: ItemId, n: number) => {
      inv.add(item, n);
    },
  };
}
const run = (d: Drops, e: DropEnv, s: number) => {
  for (let t = 0; t < s; t += 1 / 60) d.step(e, 1 / 60);
};

describe('drops', () => {
  it('fall under radial gravity, bounce and come to rest on the ground', () => {
    const inv = new Inventory();
    const d = new Drops();
    const a = d.spawn('apple', 1, at(5, 2), new Vector3(0.5, 1, 0));
    let bounced = false;
    let prevVy = 0;
    for (let t = 0; t < 3; t += 1 / 60) {
      d.step(env(inv, null), 1 / 60);
      const radial = a.v.dot(a.p.clone().normalize());
      if (prevVy < -1 && radial > 0) bounced = true;
      prevVy = radial;
    }
    expect(bounced).toBe(true);
    expect(a.state).toBe('rest');
    expect(a.p.length()).toBeCloseTo(R + DROP.restH, 5);
  });

  it('leaves drift down slowly and do not bounce', () => {
    const inv = new Inventory();
    const d = new Drops();
    const leaf = d.spawn('leaves', 1, at(5, 2), new Vector3());
    const apple = d.spawn('apple', 1, at(-5, 2), new Vector3());
    let tLeaf = 0;
    let tApple = 0;
    for (let t = 0; t < 5; t += 1 / 60) {
      d.step(env(inv, null), 1 / 60);
      if (!tApple && apple.state === 'rest') tApple = t;
      if (!tLeaf && leaf.state === 'rest') tLeaf = t;
    }
    expect(tLeaf).toBeGreaterThan(tApple * 1.5);
    expect(leaf.state).toBe('rest');
  });

  it('are pulled to a nearby character after the pick-up delay and land in the backpack', () => {
    const inv = new Inventory();
    const d = new Drops();
    d.spawn('stone', 2, at(1.0, DROP.restH), new Vector3());
    const e = env(inv, at(0));
    d.step(e, 1 / 60);
    expect(d.list[0].state).not.toBe('magnet'); // still in its pick-up delay
    run(d, e, DROP.pickupDelay + 1);
    expect(inv.count('stone')).toBe(2);
    run(d, e, DROP.collectTime + 0.05);
    expect(d.list.length).toBe(0);
  });

  it('thrown drops wait 2 s, and drops out of range stay put', () => {
    const inv = new Inventory();
    const d = new Drops();
    d.spawn('log', 1, at(0.8, DROP.restH), new Vector3(), { thrown: true });
    d.spawn('log', 1, at(-4, DROP.restH), new Vector3());
    const e = env(inv, at(0));
    run(d, e, 1.5);
    expect(inv.count('log')).toBe(0);
    run(d, e, 1.5);
    expect(inv.count('log')).toBe(1);
    expect(d.list.length).toBe(1);
    expect(d.list[0].state).toBe('rest');
  });

  it('are not attracted when the backpack is full, and part-fill leaves the rest on the ground', () => {
    const inv = new Inventory();
    for (let i = 0; i < 36; i++) inv.backpack[i] = { id: 'stone', n: i === 0 ? 61 : 64 };
    const d = new Drops();
    d.spawn('apple', 1, at(0.6, DROP.restH), new Vector3());
    d.spawn('stone', 5, at(-0.6, DROP.restH), new Vector3());
    run(d, env(inv, at(0)), 2);
    expect(inv.count('apple')).toBe(0);
    expect(inv.backpack[0]).toEqual({ id: 'stone', n: 64 });
    const left = d.list.find((x) => x.item === 'stone')!;
    expect(left.count).toBe(2);
    expect(d.list.find((x) => x.item === 'apple')!.state).toBe('rest');
    expect(d.blockedFull).toBe(true);
  });

  it('nothing is collected while the player is unavailable (travel, a screen open)', () => {
    const inv = new Inventory();
    const d = new Drops();
    d.spawn('apple', 1, at(0.3, DROP.restH), new Vector3());
    run(d, env(inv, null), 2);
    expect(inv.count('apple')).toBe(0);
  });

  it('resting drops of the same item merge; different items do not', () => {
    const inv = new Inventory();
    const d = new Drops();
    d.spawn('stone', 1, at(3, DROP.restH), new Vector3());
    d.spawn('stone', 2, at(3.2, DROP.restH), new Vector3());
    d.spawn('apple', 1, at(3.1, DROP.restH), new Vector3());
    run(d, env(inv, null), 0.5);
    expect(d.list.length).toBe(2);
    expect(d.list.find((x) => x.item === 'stone')!.count).toBe(3);
  });

  it('keeps at most DROP.max drops, removing the oldest resting one', () => {
    const d = new Drops();
    for (let i = 0; i < DROP.max + 5; i++) d.spawn('leaves', 1, at((i % 40) * 0.6 - 12, DROP.restH), new Vector3());
    expect(d.list.length).toBe(DROP.max);
  });
});
