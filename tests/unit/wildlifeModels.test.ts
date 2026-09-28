import { describe, expect, it } from 'vitest';
import { rabbit } from '../../src/game/world/wildlifeModels';
import { RABBIT_COATS } from '../../src/game/world/animals';

/** FNV-1a over the attribute's float bits: any change to a vertex changes it. */
const fnv = (a: ArrayLike<number>) => {
  const u = new Uint32Array(new Float32Array(a).buffer);
  let h = 0x811c9dc5;
  for (let i = 0; i < u.length; i++) h = Math.imul(h ^ u[i], 0x01000193) >>> 0;
  return h.toString(16);
};

// the rabbits as they were before their painter was made cheaper (progressive-loading.md phase 2):
// positions, normals and colours, bit for bit
const BEFORE: Record<string, string> = {
  'wild-down': 'de56d4e4:a29af67e:f500eddb',
  'wild-up': 'e5ab5fb9:61082f4b:ee3f73d2',
  'wild-kit': '78ee2334:e835bed9:ba065a0b',
  'grey-down': 'de56d4e4:a29af67e:effc724a',
  'grey-up': 'e5ab5fb9:61082f4b:52d802b4',
  'grey-kit': '78ee2334:e835bed9:65721b2e',
  'lop-down': '74d5044b:b0e75159:53582304',
  'lop-up': '9623ac1c:9298289b:6e1df778',
  'lop-kit': '7ea62250:ede2cbc9:8987403c',
  'dutch-down': 'de56d4e4:a29af67e:1ffcef92',
  'dutch-up': 'e5ab5fb9:61082f4b:1353ff05',
  'dutch-kit': '78ee2334:e835bed9:caf02387',
};

describe('the rabbits’ models', () => {
  it('are unchanged, bit for bit, by the faster painter and the shared blobs', () => {
    for (const coat of RABBIT_COATS)
      for (const pose of ['down', 'up', 'kit'] as const) {
        const g = rabbit(coat, pose);
        expect(['position', 'normal', 'color'].map((k) => fnv(g.getAttribute(k).array as Float32Array)).join(':'), `${coat}-${pose}`).toBe(BEFORE[`${coat}-${pose}`]);
      }
  });
});
