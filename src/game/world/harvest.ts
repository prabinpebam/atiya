/**
 * What's been harvested and is growing back (docs: collection-inventory.md §1, §3.1): the fruit on
 * each fruit tree and each picked flower. Pure; the renderer reads `scale()` for the regrow pop.
 */
export const REGROW = {
  /** Seconds until shaken fruit is back, and until a picked flower is. */
  fruit: 90,
  flower: 60,
  /** Seconds the regrowth takes to scale back up. */
  pop: 0.6,
} as const;

interface Growing {
  /** Seconds left until it starts growing back (≤ 0: growing, for `pop` s). */
  left: number;
}

export class Harvest {
  private readonly gone = new Map<string, Growing>();
  /** Bumped whenever something is taken or finishes growing back (the renderer rewrites instances). */
  version = 0;

  private static fruitKey = (tree: 'apple' | 'orange', i: number) => `fruit:${tree}:${i}`;
  private static flowerKey = (kind: string, i: number) => `flower:${kind}:${i}`;

  ripe(tree: 'apple' | 'orange', i: number): boolean {
    return !this.gone.has(Harvest.fruitKey(tree, i));
  }

  takeFruit(tree: 'apple' | 'orange', i: number): boolean {
    if (!this.ripe(tree, i)) return false;
    this.gone.set(Harvest.fruitKey(tree, i), { left: REGROW.fruit });
    this.version++;
    return true;
  }

  flowerHere(kind: string, i: number): boolean {
    return !this.gone.has(Harvest.flowerKey(kind, i));
  }

  pickFlower(kind: string, i: number): boolean {
    if (!this.flowerHere(kind, i)) return false;
    this.gone.set(Harvest.flowerKey(kind, i), { left: REGROW.flower });
    this.version++;
    return true;
  }

  /** Display scale 0…1 of a fruit tree's fruit or a flower (0 while gone, easing up as it regrows). */
  scale(key: string): number {
    const g = this.gone.get(key);
    if (!g) return 1;
    if (g.left > 0) return 0;
    const k = Math.min(1, -g.left / REGROW.pop);
    // a little overshoot as it pops back
    return k < 0.7 ? (k / 0.7) * 1.12 : 1.12 - ((k - 0.7) / 0.3) * 0.12;
  }

  fruitScale = (tree: 'apple' | 'orange', i: number) => this.scale(Harvest.fruitKey(tree, i));
  flowerScale = (kind: string, i: number) => this.scale(Harvest.flowerKey(kind, i));

  /** True while anything is mid-regrowth (the renderer animates only then). */
  get popping(): boolean {
    for (const g of this.gone.values()) if (g.left <= 0) return true;
    return false;
  }

  step(dt: number): void {
    for (const [k, g] of this.gone) {
      const was = g.left;
      g.left -= dt;
      if (was > 0 && g.left <= 0) this.version++;
      if (g.left <= -REGROW.pop) {
        this.gone.delete(k);
        this.version++;
      }
    }
  }
}
