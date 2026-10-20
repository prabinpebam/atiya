/**
 * The labelled requests Jev's threshold is set on (ai-plan P2.7; ai-services.md §9.1): each is well formed, the
 * set covers every answer Decide gives, and rules route it as labelled but for the misses listed here, which are
 * what Jev is measured on.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Block } from '../../src/site/content/schema';
import { decideRules, TYPE_ORDER, type Kind, type Outside } from '../../src/site/editor/model/aiDecide';

interface Labelled {
  id: string;
  scope: 'block' | 'section' | 'article';
  block?: string;
  instruction: string;
  needs: 'none' | 'research' | 'outside';
  outside?: Outside;
  kind: Kind;
  fits?: boolean;
}

const { requests } = JSON.parse(readFileSync('tests/fixtures/ai/decide-labels.json', 'utf8')) as { requests: Labelled[] };

const KINDS: Kind[] = ['rewrite', 'shorten', 'lengthen', 'simplify', 'fix', 'list', 'table'];
const OUTSIDES: Outside[] = ['address', 'access', 'status', 'picture'];

const rules = (r: Labelled) => decideRules({ instruction: r.instruction, scope: r.scope, block: r.block ? ({ type: r.block, key: 'k' } as unknown as Block) : undefined });
const routed = (needs: string, outside?: string) => (outside ? `${needs}:${outside}` : needs);

/** Where rules route a request differently from its label, by what went wrong. */
const RULES_MISS = {
  /** Asks for facts from outside the article without a word on rules' list. */
  research: ['r050', 'r051', 'r052', 'r053', 'r054', 'r055', 'r056', 'r059', 'r083', 'r120'],
  /** Uses a word on rules' list for the article's own words. */
  falseResearch: ['r035', 'r036', 'r037', 'r038', 'r039', 'r040', 'r090', 'r106'],
  /** Asks to change something AI can't, in words rules don't know. */
  outside: ['r067', 'r068', 'r069', 'r070', 'r073', 'r117'],
  /** Names a field in words about the article's text. */
  falseOutside: ['r041', 'r042', 'r043', 'r044', 'r108'],
};

describe('the labelled requests (P2.7)', () => {
  it('are at least 100, each well formed and asked once', () => {
    expect(requests.length).toBeGreaterThanOrEqual(100);
    expect(new Set(requests.map((r) => r.id)).size).toBe(requests.length);
    expect(new Set(requests.map((r) => r.instruction.toLowerCase())).size).toBe(requests.length);
    for (const r of requests) {
      expect(['block', 'section', 'article'], r.id).toContain(r.scope);
      expect(r.scope === 'block' ? TYPE_ORDER : [undefined], r.id).toContain(r.block);
      expect(['none', 'research', 'outside'], r.id).toContain(r.needs);
      expect(r.needs === 'outside' ? OUTSIDES : [undefined], r.id).toContain(r.outside);
      expect(KINDS, r.id).toContain(r.kind);
      expect([undefined, false], r.id).toContain(r.fits);
      if (r.scope === 'article') expect(r.fits, r.id).toBeUndefined();
    }
  });

  it('cover every answer Decide gives', () => {
    const count = (f: (r: Labelled) => boolean) => requests.filter(f).length;
    for (const scope of ['block', 'section', 'article'] as const) expect(count((r) => r.scope === scope), scope).toBeGreaterThanOrEqual(10);
    for (const needs of ['none', 'research', 'outside'] as const) expect(count((r) => r.needs === needs), needs).toBeGreaterThanOrEqual(10);
    for (const o of OUTSIDES) expect(count((r) => r.outside === o), o).toBeGreaterThanOrEqual(3);
    for (const k of KINDS) expect(count((r) => r.kind === k), k).toBeGreaterThanOrEqual(5);
    expect(count((r) => r.fits === false)).toBeGreaterThanOrEqual(5);
  });

  it('are routed by rules as labelled, but for the listed misses', () => {
    const misses: Record<keyof typeof RULES_MISS, string[]> = { research: [], falseResearch: [], outside: [], falseOutside: [] };
    for (const r of requests) {
      const d = rules(r);
      if (routed(d.needs, d.outside) === routed(r.needs, r.outside)) continue;
      if (r.needs === 'research') misses.research.push(r.id);
      else if (d.needs === 'research') misses.falseResearch.push(r.id);
      else if (r.needs === 'outside') misses.outside.push(r.id);
      else misses.falseOutside.push(r.id);
    }
    expect(misses).toEqual(RULES_MISS);
  });

  it('give typed requests a kind and a fit that rules leave to Jev', () => {
    // rules call every typed request a rewrite that fits its scope (§9.1): the labels say where Jev can do better
    expect(requests.every((r) => rules(r).kind === 'rewrite')).toBe(true);
    expect(requests.filter((r) => r.kind !== 'rewrite').length).toBe(64);
    expect(requests.filter((r) => r.fits === false).length).toBe(7);
  });
});
