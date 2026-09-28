import { describe, expect, it } from 'vitest';
import { BackSide, DoubleSide, FrontSide, InstancedMesh, Mesh, MeshDepthMaterial, MeshStandardMaterial, Texture, BoxGeometry, Vector3 } from 'three';
import { Summoner, runSliced, shadowDepthMaterial } from '../../src/game/world/summoner';
import { prebuildSteps, prebuilt } from '../../src/game/world/prebuilt';
import type { Obstacle } from '../../src/game/math/sphere';

describe('the summoner (progressive-loading.md §5.7)', () => {
  it('builds models ahead one at a time, and a view gets the same one (or builds it, if it wasn’t)', () => {
    let made = 0;
    const make = () => ({ n: ++made });
    const steps = prebuildSteps([
      ['test.a', make],
      ['test.b', make],
    ]);
    expect(made).toBe(0);
    steps.next();
    expect(made).toBe(1);
    steps.next();
    expect(made).toBe(2);
    expect(steps.next().done).toBe(true);
    expect(prebuilt('test.a', make)).toEqual({ n: 1 });
    expect(made).toBe(2);
    // (already built: skipped without yielding)
    expect(prebuildSteps([['test.a', make]]).next().done).toBe(true);
    expect(prebuilt('test.c', make)).toEqual({ n: 3 });
  });

  it('runs a resumable build to its end and returns its result', async () => {
    function* steps() {
      let s = 0;
      for (let i = 0; i < 5; i++) {
        s += i;
        yield;
      }
      return s;
    }
    expect(await runSliced(steps())).toBe(10);
  });

  it('compiles a caster’s shadow with the material the shadow map will use: its custom depth, or a plain one on the far side', () => {
    const map = new Texture();
    const front = new MeshStandardMaterial({ side: FrontSide });
    const cut = new MeshStandardMaterial({ side: DoubleSide, alphaTest: 0.5, map });
    const a = new Mesh(new BoxGeometry(), front);
    const d = shadowDepthMaterial(a, front, false) as MeshDepthMaterial;
    expect(d).toBeInstanceOf(MeshDepthMaterial);
    expect(d.side).toBe(BackSide);
    // (the same variant is shared, so its program stays alive for the shadow map)
    expect(shadowDepthMaterial(new InstancedMesh(new BoxGeometry(), front, 2), front, false)).toBe(d);
    const c = shadowDepthMaterial(a, cut, false) as MeshDepthMaterial;
    expect(c).not.toBe(d);
    expect(c.side).toBe(DoubleSide);
    expect(c.alphaTest).toBe(0.5);
    expect(c.map).toBe(map);
    const custom = new MeshDepthMaterial();
    const b = new Mesh(new BoxGeometry(), cut);
    b.customDepthMaterial = custom;
    expect(shadowDepthMaterial(b, cut, false)).toBe(custom);
    expect(custom.alphaTest).toBe(0.5);
  });

  it('holds back what isn’t out yet: its obstacles join only as it appears', () => {
    const n1 = new Vector3(1, 0, 0);
    const n2 = new Vector3(0, 1, 0);
    const o1 = { n: n1, radiusU: 0.1 } as Obstacle;
    const o2 = { n: n2, radiusU: 0.1 } as Obstacle;
    const free = { n: new Vector3(0, 0, 1), radiusU: 0.1 } as Obstacle;
    const list = [o1, o2, free];
    const store = { state: { mounted: [] as readonly string[] }, setState(p: object) { Object.assign(this.state, p); }, getState() { return this.state; } };
    const s = new Summoner({ gfx: null, camera: null, store: store as never, simObstacles: list });
    s.hold(new Map([[n1, 'props'], [n2, 'home']]));
    expect(list).toEqual([free]);
    s.bornAt.set(n1, 100);
    s.step(50);
    expect(list).toEqual([free]);
    s.step(150);
    expect(list).toContain(o1);
    expect(list).not.toContain(o2);
    s.revealed.set('home', 200);
    s.step(210);
    expect(list).toContain(o2);
    expect(s.available({ kind: 'npc', who: 'rojina', n: new Vector3(1, 1, 0) } as never)).toBe(true);
    expect(s.available({ kind: 'npc', who: 'prabin', n: new Vector3(1, 1, 0) } as never)).toBe(false);
  });
});
